import discord
from discord.ext import commands
from discord import app_commands
import os

from src.core.database import format_name
from src.core.spotify import (
    spotify_play_track, spotify_pause_playback, spotify_skip_to_next, 
    spotify_skip_to_previous, spotify_add_to_queue, spotify_like_track, 
    spotify_unlike_track, search_spotify_track, get_user_spotify_access_token,
    get_currently_playing_track
)

def get_spotify_remote_layout(track, user_id, action="Now playing"):
    view = discord.ui.LayoutView(timeout=None)
    
    spotify_icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/240px-Spotify_logo_without_text.svg.png"
    
    if track and track != "no_token":
        artists = ", ".join(track['artists'])
        album = track.get('album_name') or "Unknown Album"
        description = f"**{artists}** • *{album}*"
        title = track['name']
        thumbnail_url = track.get('album_images')[0]['url'] if track.get('album_images') else spotify_icon
    else:
        title = "Spotify Remote"
        description = "Control your playback."
        thumbnail_url = spotify_icon
        
    section = discord.ui.Section(
        discord.ui.TextDisplay(f"Spotify remote – {action}"),
        discord.ui.TextDisplay(f"{title}\n{description}"),
        accessory=discord.ui.Thumbnail(thumbnail_url)
    )
    
    user_id = str(user_id)
    row = discord.ui.ActionRow(
        discord.ui.Button(emoji="⏮️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_prev:{user_id}"),
        discord.ui.Button(emoji="⏸️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_pause:{user_id}"),
        discord.ui.Button(emoji="⏭️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_next:{user_id}"),
        discord.ui.Button(emoji="❤️", style=discord.ButtonStyle.success, custom_id=f"spotify_like:{user_id}"),
        discord.ui.Button(emoji="🔁", style=discord.ButtonStyle.secondary, custom_id=f"spotify_repeat:{user_id}")
    )
    
    container = discord.ui.Container(section, row, accent_color=discord.Color.from_rgb(29, 185, 84))
    view.add_item(container)
    return view

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

    # Removed format_embed because we use get_spotify_remote_layout instead

    async def _handle_track_command(self, ctx, query, action="play"):
        session = self.bot.session
        token = await get_user_spotify_access_token(session, str(ctx.author.id))
        from src.core.ui import create_error_layout, create_success_layout
        if not token:
            app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
            view = create_error_layout(f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
            return await ctx.send(view=view)
            
        track = await search_spotify_track(session, query)
        if not track:
            view = create_error_layout("❌ Could not find that track on Spotify.")
            return await ctx.send(view=view)
            
        if action == "play":
            res = await spotify_play_track(session, str(ctx.author.id), track['uri'])
            if res is True:
                view = get_spotify_remote_layout(track, ctx.author.id, "Now playing")
                await ctx.send(view=view)
            else:
                view = create_error_layout(f"❌ Failed to play: {res}")
                await ctx.send(view=view)
        else:
            res = await spotify_add_to_queue(session, str(ctx.author.id), track['uri'])
            if res is True:
                view = get_spotify_remote_layout(track, ctx.author.id, "Added to queue")
                await ctx.send(view=view)
            else:
                view = create_error_layout(f"❌ Failed to queue: {res}")
                await ctx.send(view=view)

    @commands.command(aliases=['rc'])
    async def remote(self, ctx):
        session = self.bot.session
        
        # Fetch currently playing track
        track = await get_currently_playing_track(session, str(ctx.author.id))
        view = get_spotify_remote_layout(track, ctx.author.id)
            
        await ctx.send(view=view)

    @commands.command(aliases=['p'])
    async def play(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                session = self.bot.session
                res = await spotify_play_track(session, str(ctx.author.id))
                from src.core.ui import create_error_layout, create_success_layout
                if res is True:
                    track = await get_currently_playing_track(session, str(ctx.author.id))
                    view = get_spotify_remote_layout(track, ctx.author.id, "Now playing")
                    return await ctx.send(view=view)
                elif res == "no_token":
                    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
                    view = create_error_layout(f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
                    return await ctx.send(view=view)
                else:
                    view = create_error_layout(f"❌ Failed to resume: {res}")
                    return await ctx.send(view=view)
                    
        await self._handle_track_command(ctx, query, "play")

    @commands.command(aliases=['q'])
    async def queue(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                from src.core.ui import create_error_layout
                view = create_error_layout("❌ Please provide a track to queue.")
                return await ctx.send(view=view)
        await self._handle_track_command(ctx, query, "queue")

    @commands.command(aliases=['ps', 'pa'])
    async def pause(self, ctx):
        session = self.bot.session
        res = await spotify_pause_playback(session, str(ctx.author.id))
        if res is True:
            track = await get_currently_playing_track(session, str(ctx.author.id))
            view = get_spotify_remote_layout(track, ctx.author.id, "Paused")
            await ctx.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await ctx.send(view=view)

    @commands.command(aliases=['sk', 'next'])
    async def skip(self, ctx):
        session = self.bot.session
        res = await spotify_skip_to_next(session, str(ctx.author.id))
        if res is True:
            track = await get_currently_playing_track(session, str(ctx.author.id))
            view = get_spotify_remote_layout(track, ctx.author.id, "Skipped")
            await ctx.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await ctx.send(view=view)

    @commands.command(aliases=['rl'])
    async def rclike(self, ctx, *, query: str = None):
        from src.core.ui import create_error_layout
        if not query:
            view = create_error_layout("❌ Please provide a track to like.")
            return await ctx.send(view=view)
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            view = create_error_layout("❌ Track not found.")
            return await ctx.send(view=view)
            
        res = await spotify_like_track(session, str(ctx.author.id), track['id'])
        if res is True:
            view = get_spotify_remote_layout(track, ctx.author.id, "Liked")
            await ctx.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await ctx.send(view=view)

    @commands.command(aliases=['ru'])
    async def rcunlike(self, ctx, *, query: str):
        session = self.bot.session
        track = await search_spotify_track(session, query)
        from src.core.ui import create_error_layout
        if not track: 
            view = create_error_layout("❌ Track not found.")
            return await ctx.send(view=view)
            
        res = await spotify_unlike_track(session, str(ctx.author.id), track['id'])
        if res is True:
            view = get_spotify_remote_layout(track, ctx.author.id, "Unliked")
            await ctx.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await ctx.send(view=view)

    async def play_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        from src.core.ui import create_error_layout
        if not track: 
            view = create_error_layout("❌ Could not find track.")
            return await interaction.followup.send(view=view)
            
        res = await spotify_play_track(session, str(interaction.user.id), track['uri'])
        if res is True:
            view = get_spotify_remote_layout(track, interaction.user.id, "Now playing")
            await interaction.followup.send(view=view)
        elif res == "no_token":
            from src.core.ui import create_error_layout
            view = create_error_layout("❌ You need to link your Spotify account first.")
            await interaction.followup.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await interaction.followup.send(view=view)

    async def queue_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        from src.core.ui import create_error_layout
        if not track: 
            view = create_error_layout("❌ Could not find track.")
            return await interaction.followup.send(view=view)
            
        res = await spotify_add_to_queue(session, str(interaction.user.id), track['uri'])
        if res is True:
            view = get_spotify_remote_layout(track, interaction.user.id, "Added to queue")
            await interaction.followup.send(view=view)
        elif res == "no_token":
            from src.core.ui import create_error_layout
            view = create_error_layout("❌ You need to link your Spotify account first.")
            await interaction.followup.send(view=view)
        else:
            from src.core.ui import create_error_layout
            view = create_error_layout(f"❌ Failed: {res}")
            await interaction.followup.send(view=view)

async def setup(bot):
    await bot.add_cog(SpotifyRemote(bot))
