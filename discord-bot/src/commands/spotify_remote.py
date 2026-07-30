import discord
from discord.ext import commands
from discord import app_commands
import os

from src.core.database import format_name
from src.core.spotify import (
    spotify_play_track, spotify_pause_playback, spotify_skip_to_next, 
    spotify_skip_to_previous, spotify_add_to_queue, spotify_like_track, 
    spotify_unlike_track, search_spotify_track, get_user_spotify_access_token
)

class SpotifyRemoteView(discord.ui.View):
    def __init__(self, user_id):
        super().__init__(timeout=None)
        self.user_id = str(user_id)
        self.add_item(discord.ui.Button(emoji="⏪", style=discord.ButtonStyle.secondary, custom_id=f"spotify_prev:{self.user_id}"))
        self.add_item(discord.ui.Button(emoji="⏸", style=discord.ButtonStyle.secondary, custom_id=f"spotify_play:{self.user_id}"))
        self.add_item(discord.ui.Button(emoji="⏩", style=discord.ButtonStyle.secondary, custom_id=f"spotify_next:{self.user_id}"))
        self.add_item(discord.ui.Button(emoji="❤️", style=discord.ButtonStyle.success, custom_id=f"spotify_like:{self.user_id}"))
        self.add_item(discord.ui.Button(emoji="🔁", style=discord.ButtonStyle.secondary, custom_id=f"spotify_repeat:{self.user_id}"))

class SpotifyRemote(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
        self.ctx_menu_play = app_commands.ContextMenu(
            name="Play on Spotify",
            callback=self.play_context_menu,
        )
        self.ctx_menu_queue = app_commands.ContextMenu(
            name="Queue on Spotify",
            callback=self.queue_context_menu,
        )
        self.bot.tree.add_command(self.ctx_menu_play)
        self.bot.tree.add_command(self.ctx_menu_queue)

    def format_embed(self, embed, track):
        embed.set_author(name="Spotify remote – Now playing", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        embed.title = track['name']
        if track.get('spotify_url'):
            embed.url = track['spotify_url']
        artists = ", ".join(track['artists'])
        album = track.get('album_name') or "Unknown Album"
        embed.description = f"**{artists}** • *{album}*"
        return embed

    async def _handle_track_command(self, ctx, query, action="play"):
        session = self.bot.session
        token = await get_user_spotify_access_token(session, str(ctx.author.id))
        if not token:
            app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
            embed = discord.Embed(color=0xFF0000, description=f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
            return await ctx.send(embed=embed)
            
        track = await search_spotify_track(session, query)
        if not track:
            embed = discord.Embed(color=0xFF0000, description="❌ Could not find that track on Spotify.")
            return await ctx.send(embed=embed)
            
        embed = discord.Embed(color=0x1DB954)
        if action == "play":
            res = await spotify_play_track(session, str(ctx.author.id), track['uri'])
            if res is True:
                embed = self.format_embed(embed, track)
                view = SpotifyRemoteView(ctx.author.id)
                await ctx.send(embed=embed, view=view)
            else:
                embed.color = 0xFF0000
                embed.description = f"❌ Failed to play: {res}"
                await ctx.send(embed=embed)
        else:
            res = await spotify_add_to_queue(session, str(ctx.author.id), track['uri'])
            if res is True:
                embed = self.format_embed(embed, track)
                embed.set_author(name="Spotify remote – Added to queue", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
                await ctx.send(embed=embed)
            else:
                embed.color = 0xFF0000
                embed.description = f"❌ Failed to queue: {res}"
                await ctx.send(embed=embed)

    @commands.command(aliases=['rc'])
    async def remote(self, ctx):
        view = SpotifyRemoteView(ctx.author.id)
        embed = discord.Embed(title="Spotify Remote", description="Control your playback.", color=0x1DB954)
        embed.set_author(name="Spotify remote – Now playing", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        await ctx.send(embed=embed, view=view)

    @commands.command(aliases=['p'])
    async def play(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                session = self.bot.session
                res = await spotify_play_track(session, str(ctx.author.id))
                embed = discord.Embed(color=0x1DB954)
                if res is True:
                    embed.set_author(name="Spotify remote – Now playing", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
                    embed.description = "▶️ Resumed playback."
                    view = SpotifyRemoteView(ctx.author.id)
                    return await ctx.send(embed=embed, view=view)
                elif res == "no_token":
                    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
                    embed.color = 0xFF0000
                    embed.description = f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})"
                    return await ctx.send(embed=embed)
                else:
                    embed.color = 0xFF0000
                    embed.description = f"❌ Failed to resume: {res}"
                    return await ctx.send(embed=embed)
                    
        await self._handle_track_command(ctx, query, "play")

    @commands.command(aliases=['q'])
    async def queue(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                embed = discord.Embed(color=0xFF0000, description="❌ Please provide a track to queue.")
                return await ctx.send(embed=embed)
        await self._handle_track_command(ctx, query, "queue")

    @commands.command(aliases=['ps', 'pa'])
    async def pause(self, ctx):
        session = self.bot.session
        res = await spotify_pause_playback(session, str(ctx.author.id))
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed.set_author(name="Spotify remote – Paused", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
            embed.description = "⏸️ Paused playback."
            view = SpotifyRemoteView(ctx.author.id)
            await ctx.send(embed=embed, view=view)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await ctx.send(embed=embed)

    @commands.command(aliases=['sk', 'next'])
    async def skip(self, ctx):
        session = self.bot.session
        res = await spotify_skip_to_next(session, str(ctx.author.id))
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed.set_author(name="Spotify remote – Skipped", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
            embed.description = "⏭️ Skipped track."
            view = SpotifyRemoteView(ctx.author.id)
            await ctx.send(embed=embed, view=view)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await ctx.send(embed=embed)

    @commands.command(aliases=['rl'])
    async def rclike(self, ctx, *, query: str = None):
        if not query:
            embed = discord.Embed(color=0xFF0000, description="❌ Please provide a track to like.")
            return await ctx.send(embed=embed)
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Track not found.")
            return await ctx.send(embed=embed)
            
        res = await spotify_like_track(session, str(ctx.author.id), track['id'])
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed = self.format_embed(embed, track)
            embed.set_author(name="Spotify remote – Liked", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
            await ctx.send(embed=embed)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await ctx.send(embed=embed)

    @commands.command(aliases=['ru'])
    async def rcunlike(self, ctx, *, query: str):
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Track not found.")
            return await ctx.send(embed=embed)
            
        res = await spotify_unlike_track(session, str(ctx.author.id), track['id'])
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed = self.format_embed(embed, track)
            embed.set_author(name="Spotify remote – Unliked", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
            await ctx.send(embed=embed)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await ctx.send(embed=embed)

    async def play_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Could not find track.")
            return await interaction.followup.send(embed=embed)
            
        res = await spotify_play_track(session, str(interaction.user.id), track['uri'])
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed = self.format_embed(embed, track)
            await interaction.followup.send(embed=embed)
        elif res == "no_token":
            embed.color = 0xFF0000
            embed.description = "❌ You need to link your Spotify account first."
            await interaction.followup.send(embed=embed)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await interaction.followup.send(embed=embed)

    async def queue_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Could not find track.")
            return await interaction.followup.send(embed=embed)
            
        res = await spotify_add_to_queue(session, str(interaction.user.id), track['uri'])
        embed = discord.Embed(color=0x1DB954)
        if res is True:
            embed = self.format_embed(embed, track)
            embed.set_author(name="Spotify remote – Added to queue", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
            await interaction.followup.send(embed=embed)
        elif res == "no_token":
            embed.color = 0xFF0000
            embed.description = "❌ You need to link your Spotify account first."
            await interaction.followup.send(embed=embed)
        else:
            embed.color = 0xFF0000
            embed.description = f"❌ Failed: {res}"
            await interaction.followup.send(embed=embed)

async def setup(bot):
    await bot.add_cog(SpotifyRemote(bot))
