import discord
from discord.ext import commands
from discord import app_commands
import random
import io
import asyncio
import difflib
from PIL import Image
from ..utils.api import fetch_top_artists, fetch_top_tracks

from src.core.database import format_name

class ScrambleView(discord.ui.View):
    def __init__(self, target, original_embed, hints):
        super().__init__(timeout=None)
        self.target = target
        self.original_embed = original_embed
        self.hints = hints
        self.current_hint_index = 0
        self.scrambled = self._scramble(target)
        self.given_up = False
        self.stop_event = asyncio.Event()

    def _scramble(self, target):
        words = target.split(" ")
        scrambled_words = []
        for word in words:
            chars = list(word)
            random.shuffle(chars)
            scrambled_words.append("".join(chars))
        scrambled = " ".join(scrambled_words)
        if scrambled.lower() == target.lower() and len(target) > 2:
            chars = list(target.replace(" ", ""))
            random.shuffle(chars)
            scrambled = "".join(chars)
        return scrambled

    def update_embed(self):
        desc = f"Unscramble this artist name:\n\n# {self.scrambled}\n\n"
        if self.current_hint_index > 0:
            desc = f"Unscramble this artist name ({len(self.hints)} extra hints available):\n\n# {self.scrambled}\n\n"
            for i in range(self.current_hint_index):
                if i < len(self.hints):
                    desc += f"• {self.hints[i]}\n"
        
        if hasattr(self, 'last_interactor') and self.last_interactor:
            desc += f"\n*Last hint revealed by {self.last_interactor.display_name}*\n"
            
        desc += "\nType your answer within 30 seconds to make a guess"
        self.original_embed.description = desc

    @discord.ui.button(label="Add hint", style=discord.ButtonStyle.secondary)
    async def add_hint(self, interaction: discord.Interaction, button: discord.ui.Button):
        if self.current_hint_index < len(self.hints):
            self.current_hint_index += 1
            if self.current_hint_index >= len(self.hints):
                button.disabled = True
            self.last_interactor = interaction.user
            self.update_embed()
            await interaction.response.edit_message(embed=self.original_embed, view=self)
        else:
            await interaction.response.defer()

    @discord.ui.button(label="Reshuffle", style=discord.ButtonStyle.secondary)
    async def reshuffle(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.scrambled = self._scramble(self.target)
        self.update_embed()
        await interaction.response.edit_message(embed=self.original_embed, view=self)

    @discord.ui.button(label="Give up", style=discord.ButtonStyle.danger)
    async def give_up(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.given_up = True
        self.stop_event.set()
        
        from src.core.theme import Theme
        self.original_embed.description = f"**Time is up!**\nIt was **{self.target}**"
        self.original_embed.color = Theme.ERROR
        
        for child in self.children:
            child.disabled = True
            
        await interaction.response.edit_message(embed=self.original_embed, view=self)
        self.stop()

class GuessView(discord.ui.View):
    def __init__(self, album_name, artist_name, original_embed, hints, img):
        super().__init__(timeout=None)
        self.album_name = album_name
        self.artist_name = artist_name
        self.original_embed = original_embed
        self.hints = hints
        self.img = img
        self.current_hint_index = 0
        self.given_up = False
        self.stop_event = asyncio.Event()

    def generate_pixelated_image(self):
        sizes = [16, 12, 8, 5, 3]
        if self.current_hint_index < len(sizes):
            pixel_size = sizes[self.current_hint_index]
        else:
            pixel_size = 1
            
        if pixel_size <= 1:
            buf = io.BytesIO()
            self.img.save(buf, format='PNG')
            buf.seek(0)
            return discord.File(buf, filename="pixel.png")
            
        small = self.img.resize((max(1, self.img.size[0] // pixel_size), max(1, self.img.size[1] // pixel_size)), Image.BILINEAR)
        pixelated = small.resize(self.img.size, Image.NEAREST)
        buf = io.BytesIO()
        pixelated.save(buf, format='PNG')
        buf.seek(0)
        return discord.File(buf, filename="pixel.png")

    def update_embed(self):
        desc = "Guess the album name or artist!\nYou have 30 seconds.\n\n"
        if self.current_hint_index > 0:
            desc = f"Guess the album name or artist! ({len(self.hints)} extra hints available):\n\nYou have 30 seconds.\n\n"
            for i in range(self.current_hint_index):
                if i < len(self.hints):
                    desc += f"• {self.hints[i]}\n"
                    
        if hasattr(self, 'last_interactor') and self.last_interactor:
            desc += f"\n*Last hint revealed by {self.last_interactor.display_name}*\n"
            
        self.original_embed.description = desc
        self.original_embed.set_image(url="attachment://pixel.png")

    @discord.ui.button(label="Add hint", style=discord.ButtonStyle.secondary)
    async def add_hint(self, interaction: discord.Interaction, button: discord.ui.Button):
        if self.current_hint_index < len(self.hints):
            self.current_hint_index += 1
            if self.current_hint_index >= len(self.hints):
                button.disabled = True
            self.last_interactor = interaction.user
            self.update_embed()
            file = self.generate_pixelated_image()
            await interaction.response.edit_message(embed=self.original_embed, view=self, attachments=[file])
        else:
            await interaction.response.defer()

    @discord.ui.button(label="Give up", style=discord.ButtonStyle.danger)
    async def give_up(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.given_up = True
        self.stop_event.set()
        
        from src.core.theme import Theme
        self.original_embed.description = f"**Time is up!**\nIt was **{self.album_name}** by **{self.artist_name}**"
        self.original_embed.color = Theme.ERROR
        
        for child in self.children:
            child.disabled = True
            
        buf = io.BytesIO()
        self.img.save(buf, format='PNG')
        buf.seek(0)
        file = discord.File(buf, filename="pixel.png")
            
        await interaction.response.edit_message(embed=self.original_embed, view=self, attachments=[file])
        self.stop()


class GamesCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    def is_close_match(self, guess, target, threshold=0.85, allow_substring=True):
        guess = guess.lower().strip()
        target = target.lower().strip()
        if len(guess) < 3:
            return False
            
        if allow_substring:
            if guess in target and len(guess) >= len(target) * 0.5:
                return True
            if target in guess:
                return True
                
        ratio = difflib.SequenceMatcher(None, guess, target).ratio()
        return ratio >= threshold

    async def wait_for_guess(self, check, timeout=30.0, stop_event=None):
        end_time = asyncio.get_event_loop().time() + timeout
        while True:
            if stop_event and stop_event.is_set():
                return None
            remaining = end_time - asyncio.get_event_loop().time()
            if remaining <= 0:
                return None
                
            msg_task = asyncio.create_task(self.bot.wait_for('message', check=check))
            edit_task = asyncio.create_task(self.bot.wait_for('message_edit', check=lambda b, a: check(a)))
            
            tasks = [msg_task, edit_task]
            if stop_event:
                stop_task = asyncio.create_task(stop_event.wait())
                tasks.append(stop_task)
            
            done, pending = await asyncio.wait(tasks, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            
            for task in pending:
                task.cancel()
                
            if not done:
                return None
                
            if stop_event and stop_task in done:
                return None
                
            done_tasks = list(done)
            task = done_tasks[0]
            if stop_event and task == stop_task:
                return None
                
            try:
                result = task.result()
                if isinstance(result, tuple):
                    return result[1]
                else:
                    return result
            except asyncio.CancelledError:
                pass
        return None

    async def run_guess_game(self, context):
        from ..core.events import get_lastfm_username
        from ..utils.api import fetch_top_albums
        import aiohttp

        user = context.author if isinstance(context, commands.Context) else context.user
        channel = context.channel

        if isinstance(context, discord.Interaction):
            if channel is None or isinstance(channel, discord.PartialMessageable):
                msg = "❌ This game requires me to read your chat! You can only play it in servers where DJ Scratch is added, or directly in my DMs."
                await context.followup.send(msg)
                return

        username = await get_lastfm_username(user.id)
        if not username:
            msg = "You need to link your Last.fm first using `/login`!"
            if isinstance(context, discord.Interaction):
                await context.followup.send(msg)
            else:
                await context.send(msg)
            return

        data = await fetch_top_albums(username, 'overall', 50)
        if not data or 'topalbums' not in data or not data['topalbums']['album']:
            msg = "Not enough data to play guess!"
            if isinstance(context, discord.Interaction):
                await context.followup.send(msg)
            else:
                await context.send(msg)
            return

        albums = [a for a in data['topalbums']['album'] if a['image'][-1]['#text']]
        if not albums:
            msg = "No album art found!"
            if isinstance(context, discord.Interaction):
                await context.followup.send(msg)
            else:
                await context.send(msg)
            return
            
        target = random.choice(albums)
        album_name = target['name']
        artist_name = target['artist']['name']
        img_url = target['image'][-1]['#text']

        # Download image
        async with aiohttp.ClientSession() as session:
            async with session.get(img_url) as resp:
                if resp.status != 200:
                    msg = "Failed to download album art!"
                    if isinstance(context, discord.Interaction):
                        return await context.followup.send(msg)
                    else:
                        return await context.send(msg)
                img_bytes = await resp.read()

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        
        hints = [
            f"The artist name starts with **{artist_name[0]}**",
            f"The album name has **{len(album_name.split())}** words",
        ]
        if target.get('playcount') and int(target['playcount']) > 0:
            hints.append(f"You have **{target['playcount']}** plays on this album")
        hints.append(f"The artist name has **{len(artist_name)}** characters")

        from src.core.theme import Theme
        embed = Theme.get_embed(title="<:pixel:1531835168430493746> Pixelated Album", description="Guess the album name or artist!\nYou have 30 seconds.", color=Theme.PRIMARY)
        
        view = GuessView(album_name, artist_name, embed, hints, img)
        file = view.generate_pixelated_image()
        view.update_embed()
        
        if isinstance(context, discord.Interaction):
            message = await context.followup.send(embed=embed, file=file, view=view, wait=True)
        else:
            message = await context.send(embed=embed, file=file, view=view)

        def check(m):
            if m.channel != channel: return False
            return self.is_close_match(m.content, album_name) or self.is_close_match(m.content, artist_name)

        msg_out = await self.wait_for_guess(check, timeout=30.0, stop_event=view.stop_event)
        
        if view.given_up:
            return

        for child in view.children:
            child.disabled = True

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        final_file = discord.File(buf, filename="pixel.png")

        if msg_out:
            embed.color = Theme.SUCCESS
            embed.description = f"<a:celebrate:1531835618013876326> **{msg_out.author.display_name}** got it right! It was **{album_name}** by **{artist_name}**!"
            await message.edit(embed=embed, view=view, attachments=[final_file])
        else:
            embed.color = Theme.ERROR
            embed.description = f"❌ Nobody got it right! It was **{album_name}** by **{artist_name}**."
            await message.edit(embed=embed, view=view, attachments=[final_file])

    @app_commands.command(name="guess", description="Play a game guessing a pixelated album cover")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def guess_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.run_guess_game(interaction)

    @commands.command(name="guess", aliases=["pixel", "px"])
    async def guess_prefix(self, ctx):
        await self.run_guess_game(ctx)

    async def run_scramble_game(self, context):
        from ..core.events import get_lastfm_username
        
        user = context.author if isinstance(context, commands.Context) else context.user
        channel = context.channel

        if isinstance(context, discord.Interaction):
            if channel is None or isinstance(channel, discord.PartialMessageable):
                msg = "❌ This game requires me to read your chat! You can only play it in servers where DJ Scratch is added, or directly in my DMs."
                await context.followup.send(msg)
                return

        username = await get_lastfm_username(user.id)
        if not username:
            msg = "You need to link your Last.fm first using `/login`!"
            if isinstance(context, discord.Interaction):
                await context.followup.send(msg)
            else:
                await context.send(msg)
            return

        # Fetch top artists
        data = await fetch_top_artists(username, 'overall', 50)
        if not data or 'topartists' not in data or not data['topartists']['artist']:
            msg = "Not enough data to play scramble!"
            if isinstance(context, discord.Interaction):
                await context.followup.send(msg)
            else:
                await context.send(msg)
            return

        artists = [a['name'] for a in data['topartists']['artist']]
        target = random.choice(artists)
        
        # Fetch hints
        from ..core.spotify import search_spotify_artist
        from ..utils.api import fetch_musicbrainz_artist_info, fetch_artist_playcount
        
        mb_info, sp_info, pc = await asyncio.gather(
            fetch_musicbrainz_artist_info(self.bot.session, target),
            search_spotify_artist(self.bot.session, target),
            fetch_artist_playcount(self.bot.session, username, target)
        )
        
        hints = []
        if sp_info and sp_info.get('popularity'):
            hints.append(f"They have a popularity of **{sp_info['popularity']}** out of 100")
        if mb_info and mb_info.get('country'):
            code = mb_info['country'].upper()
            flag = chr(ord(code[0]) + 127397) + chr(ord(code[1]) + 127397) if len(code) == 2 else code
            hints.append(f"Their country flag: {flag}")
        if sp_info and sp_info.get('genres'):
            hints.append(f"One of their genres is **{random.choice(sp_info['genres'])}**")
        if pc > 0:
            hints.append(f"You have **{pc}** plays on this artist")
        if mb_info and mb_info.get('start_date'):
            hints.append(f"They started on **{mb_info['start_date']}**")
        if mb_info and mb_info.get('type'):
            hints.append(f"They are a **{mb_info['type'].lower()}**")

        from src.core.theme import Theme
        embed = Theme.get_embed(title="🎵 Artist Scramble", description="", color=Theme.PRIMARY)
        
        view = ScrambleView(target, embed, hints)
        view.update_embed()
        
        if isinstance(context, discord.Interaction):
            message = await context.followup.send(embed=embed, view=view, wait=True)
        else:
            message = await context.send(embed=embed, view=view)

        def check(m):
            if m.channel != channel: return False
            return self.is_close_match(m.content, target, threshold=0.85, allow_substring=False)

        msg_out = await self.wait_for_guess(check, timeout=30.0, stop_event=view.stop_event)
        
        if view.given_up:
            return # The Give Up button handled the failure message

        for child in view.children:
            child.disabled = True
            
        if msg_out:
            embed.color = Theme.SUCCESS
            embed.description = f"<a:celebrate:1531835618013876326> **{msg_out.author.display_name}** got it right! The artist was **{target}**!"
            await message.edit(embed=embed, view=view)
        else:
            embed.color = Theme.ERROR
            embed.description = f"❌ Nobody got it right! The artist was **{target}**."
            await message.edit(embed=embed, view=view)

    @app_commands.command(name="scramble", description="Play a game unscrambling an artist's name")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def scramble_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.run_scramble_game(interaction)

    @commands.command(name="scramble", aliases=["jumble", "jb", "jm"])
    async def scramble_prefix(self, ctx):
        await self.run_scramble_game(ctx)

async def setup(bot):
    await bot.add_cog(GamesCog(bot))

