import discord
from discord.ext import commands
from discord import app_commands
import aiohttp
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
        
    async def check_auth(self, interaction: discord.Interaction):
        if str(interaction.user.id) != self.user_id:
            await interaction.response.send_message("This is not your remote!", ephemeral=True)
            return False
        return True
        
    async def handle_response(self, interaction: discord.Interaction, result):
        if result == "no_token":
            app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://the-goats-dj.vercel.app")
            await interaction.response.send_message(f"You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={interaction.user.id})", ephemeral=True)
        elif result is True:
            await interaction.response.send_message("Action successful!", ephemeral=True)
        else:
            await interaction.response.send_message(f"Failed: {result}", ephemeral=True)

    @discord.ui.button(emoji="⏮️", style=discord.ButtonStyle.secondary)
    async def previous(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await self.check_auth(interaction): return
        async with aiohttp.ClientSession() as session:
            res = await spotify_skip_to_previous(session, self.user_id)
            await self.handle_response(interaction, res)

    @discord.ui.button(emoji="⏯️", style=discord.ButtonStyle.primary)
    async def play_pause(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await self.check_auth(interaction): return
        async with aiohttp.ClientSession() as session:
            res = await spotify_pause_playback(session, self.user_id)
            if res is not True:
                res = await spotify_play_track(session, self.user_id)
            await self.handle_response(interaction, res)

    @discord.ui.button(emoji="⏭️", style=discord.ButtonStyle.secondary)
    async def next(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not await self.check_auth(interaction): return
        async with aiohttp.ClientSession() as session:
            res = await spotify_skip_to_next(session, self.user_id)
            await self.handle_response(interaction, res)


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

    async def _handle_track_command(self, ctx, query, action="play"):
        async with aiohttp.ClientSession() as session:
            token = await get_user_spotify_access_token(session, str(ctx.author.id))
            if not token:
                app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://the-goats-dj.vercel.app")
                return await ctx.send(f"You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
                
            track = await search_spotify_track(session, query)
            if not track:
                return await ctx.send("Could not find that track on Spotify.")
                
            if action == "play":
                res = await spotify_play_track(session, str(ctx.author.id), track['uri'])
                if res is True:
                    await ctx.send(f"▶️ Playing **{track['name']}** by {', '.join(track['artists'])}")
                else:
                    await ctx.send(f"Failed to play: {res}")
            else:
                res = await spotify_add_to_queue(session, str(ctx.author.id), track['uri'])
                if res is True:
                    await ctx.send(f"🎵 Added **{track['name']}** to queue!")
                else:
                    await ctx.send(f"Failed to queue: {res}")

    @commands.command(aliases=['rc'])
    async def remote(self, ctx):
        view = SpotifyRemoteView(ctx.author.id)
        embed = discord.Embed(title="Spotify Remote", description="Control your playback.", color=0x1DB954)
        await ctx.send(embed=embed, view=view)

    @commands.command(aliases=['p'])
    async def play(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                async with aiohttp.ClientSession() as session:
                    res = await spotify_play_track(session, str(ctx.author.id))
                    if res is True:
                        return await ctx.send("▶️ Resumed playback.")
                    elif res == "no_token":
                        app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://the-goats-dj.vercel.app")
                        return await ctx.send(f"You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
                    else:
                        return await ctx.send(f"Failed to resume: {res}")
                        
        await self._handle_track_command(ctx, query, "play")

    @commands.command(aliases=['q'])
    async def queue(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                return await ctx.send("Please provide a track to queue.")
        await self._handle_track_command(ctx, query, "queue")

    @commands.command(aliases=['ps', 'pa'])
    async def pause(self, ctx):
        async with aiohttp.ClientSession() as session:
            res = await spotify_pause_playback(session, str(ctx.author.id))
            if res is True:
                await ctx.send("⏸️ Paused playback.")
            else:
                await ctx.send(f"Failed: {res}")

    @commands.command(aliases=['sk', 'next'])
    async def skip(self, ctx):
        async with aiohttp.ClientSession() as session:
            res = await spotify_skip_to_next(session, str(ctx.author.id))
            if res is True:
                await ctx.send("⏭️ Skipped track.")
            else:
                await ctx.send(f"Failed: {res}")

    @commands.command(aliases=['rl'])
    async def rclike(self, ctx, *, query: str = None):
        if not query:
            return await ctx.send("Please provide a track to like.")
        async with aiohttp.ClientSession() as session:
            track = await search_spotify_track(session, query)
            if not track: return await ctx.send("Track not found.")
            res = await spotify_like_track(session, str(ctx.author.id), track['id'])
            if res is True:
                await ctx.send(f"❤️ Liked **{track['name']}** on Spotify.")
            else:
                await ctx.send(f"Failed: {res}")

    @commands.command(aliases=['ru'])
    async def rcunlike(self, ctx, *, query: str):
        async with aiohttp.ClientSession() as session:
            track = await search_spotify_track(session, query)
            if not track: return await ctx.send("Track not found.")
            res = await spotify_unlike_track(session, str(ctx.author.id), track['id'])
            if res is True:
                await ctx.send(f"💔 Unliked **{track['name']}** on Spotify.")
            else:
                await ctx.send(f"Failed: {res}")

    async def play_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        async with aiohttp.ClientSession() as session:
            track = await search_spotify_track(session, query)
            if not track: return await interaction.followup.send("Could not find track.")
            res = await spotify_play_track(session, str(interaction.user.id), track['uri'])
            if res is True:
                await interaction.followup.send(f"▶️ Playing **{track['name']}** on Spotify!")
            elif res == "no_token":
                await interaction.followup.send("You need to link your Spotify account first.")
            else:
                await interaction.followup.send(f"Failed: {res}")

    async def queue_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        async with aiohttp.ClientSession() as session:
            track = await search_spotify_track(session, query)
            if not track: return await interaction.followup.send("Could not find track.")
            res = await spotify_add_to_queue(session, str(interaction.user.id), track['uri'])
            if res is True:
                await interaction.followup.send(f"🎵 Queued **{track['name']}** on Spotify!")
            elif res == "no_token":
                await interaction.followup.send("You need to link your Spotify account first.")
            else:
                await interaction.followup.send(f"Failed: {res}")

async def setup(bot):
    await bot.add_cog(SpotifyRemote(bot))
