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

    async def wait_for_guess(self, check, timeout=30.0):
        end_time = asyncio.get_event_loop().time() + timeout
        while True:
            remaining = end_time - asyncio.get_event_loop().time()
            if remaining <= 0:
                return None
                
            msg_task = asyncio.create_task(self.bot.wait_for('message', check=check))
            edit_task = asyncio.create_task(self.bot.wait_for('message_edit', check=lambda b, a: check(a)))
            
            done, pending = await asyncio.wait([msg_task, edit_task], timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            
            for task in pending:
                task.cancel()
                
            if not done:
                return None
                
            task = done.pop()
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

        # Download and pixelate
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
        # Pixelate
        pixel_size = 16
        small = img.resize((img.size[0] // pixel_size, img.size[1] // pixel_size), Image.BILINEAR)
        pixelated = small.resize(img.size, Image.NEAREST)

        buf = io.BytesIO()
        pixelated.save(buf, format='PNG')
        buf.seek(0)
        
        file = discord.File(buf, filename="pixel.png")
        from src.core.theme import Theme
        embed = Theme.get_embed(title="🖼️ Pixelated Album", description="Guess the album name or artist!\nYou have 30 seconds.", color=Theme.PRIMARY)
        embed.set_image(url="attachment://pixel.png")
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed, file=file)
        else:
            await context.send(embed=embed, file=file)

        def check(m):
            if m.channel != channel: return False
            return self.is_close_match(m.content, album_name) or self.is_close_match(m.content, artist_name)

        msg_out = await self.wait_for_guess(check, timeout=30.0)
        if msg_out:
            await channel.send(f"🎉 **{msg_out.author.display_name}** got it! It was **{album_name}** by **{artist_name}**!")
        else:
            await channel.send(f"⏰ Time's up! It was **{album_name}** by **{artist_name}**.")

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
        
        # Scramble
        words = target.split(" ")
        scrambled_words = []
        for word in words:
            chars = list(word)
            random.shuffle(chars)
            scrambled_words.append("".join(chars))
        scrambled = " ".join(scrambled_words)
        
        # If the scramble accidentally equals the target, shuffle again
        if scrambled.lower() == target.lower() and len(target) > 2:
            chars = list(target.replace(" ", ""))
            random.shuffle(chars)
            scrambled = "".join(chars)

        from src.core.theme import Theme
        embed = Theme.get_embed(title="🎵 Artist Scramble", description=f"Unscramble this artist name:\n\n**`{scrambled.upper()}`**\n\nYou have 30 seconds!", color=Theme.PRIMARY)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

        def check(m):
            if m.channel != channel: return False
            return self.is_close_match(m.content, target, threshold=0.85, allow_substring=False)

        msg_out = await self.wait_for_guess(check, timeout=30.0)
        if msg_out:
            await channel.send(f"🎉 **{msg_out.author.display_name}** got it! The artist was **{target}**!")
        else:
            await channel.send(f"⏰ Time's up! The artist was **{target}**.")

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

