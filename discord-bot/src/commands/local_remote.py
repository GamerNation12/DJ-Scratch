import discord
from discord.ext import commands
from src.core.socket_server import send_spicetify_command
from src.core.spotify import search_spotify_track
from src.core.ui import create_error_layout, create_success_layout, create_simple_layout

OWNER_ID = 759433582107426816

def get_local_remote_layout(track, action="Now playing"):
    view = discord.ui.LayoutView(timeout=None)
    spotify_icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/240px-Spotify_logo_without_text.svg.png"
    
    if track:
        artists = ", ".join(track['artists'])
        album = track.get('album_name') or "Unknown Album"
        description = f"**{artists}** • *{album}*"
        title = track['name']
        thumbnail_url = track.get('album_images')[0]['url'] if track.get('album_images') else spotify_icon
    else:
        title = "Local Remote"
        description = "Control your playback."
        thumbnail_url = spotify_icon
        
    section = discord.ui.Section(
        discord.ui.TextDisplay(f"Spotify remote – {action}"),
        discord.ui.TextDisplay(f"{title}\n{description}"),
        accessory=discord.ui.Thumbnail(thumbnail_url)
    )
    
    container = discord.ui.Container(section, accent_color=discord.Color.from_rgb(29, 185, 84))
    view.add_item(container)
    return view

class LocalRemote(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def cog_check(self, ctx):
        return ctx.author.id == OWNER_ID

    @commands.command(name="lplay", aliases=["lp"])
    async def lplay(self, ctx, *, query: str = None):
        if not query:
            await send_spicetify_command(OWNER_ID, {"action": "play"})
            view = create_simple_layout("▶️ Resumed local playback", color=discord.Color.from_rgb(29, 185, 84), title="Local Remote - Now playing")
            return await ctx.send(view=view)
            
        view = create_simple_layout(f"🔍 Searching for `{query}`...", color=discord.Color.from_rgb(29, 185, 84))
        msg = await ctx.send(view=view)
        
        session = self.bot.session
        track = await search_spotify_track(session, query)
        
        if not track:
            err_view = create_error_layout("❌ Could not find that track on Spotify.")
            return await msg.edit(embeds=[], view=err_view)
            
        await send_spicetify_command(OWNER_ID, {"action": "play", "uri": track['uri']})
        
        track_view = get_local_remote_layout(track, "Now playing")
        await msg.edit(embeds=[], view=track_view)

    @commands.command(name="lpause", aliases=["lps"])
    async def lpause(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "pause"})
        view = create_simple_layout("⏸️ Paused local playback", color=discord.Color.from_rgb(29, 185, 84), title="Local Remote - Paused")
        await ctx.send(view=view)

    @commands.command(name="lskip", aliases=["lnext", "ls"])
    async def lskip(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "next"})
        view = create_simple_layout("⏭️ Skipped local track", color=discord.Color.from_rgb(29, 185, 84), title="Local Remote - Skipped")
        await ctx.send(view=view)

    @commands.command(name="lprev", aliases=["lprevious"])
    async def lprev(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "previous"})
        view = create_simple_layout("⏮️ Previous local track", color=discord.Color.from_rgb(29, 185, 84), title="Local Remote - Previous")
        await ctx.send(view=view)

async def setup(bot):
    await bot.add_cog(LocalRemote(bot))
