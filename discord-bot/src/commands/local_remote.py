import discord
from discord.ext import commands
from src.core.socket_server import send_spicetify_command
from src.core.spotify import search_spotify_track
import aiohttp

# Hardcoded owner ID for the bot owner
OWNER_ID = 759433582107426816

class LocalRemote(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def cog_check(self, ctx):
        return ctx.author.id == OWNER_ID

    @commands.command(name="lplay", aliases=["lp"])
    async def lplay(self, ctx, *, query: str = None):
        if not query:
            await send_spicetify_command(OWNER_ID, {"action": "play"})
            return await ctx.send("▶️ Sent **Resume** command to local Spotify.")
            
        msg = await ctx.send(f"🔍 Searching for `{query}`...")
        async with aiohttp.ClientSession() as session:
            track = await search_spotify_track(session, query)
            if not track:
                return await msg.edit(content="❌ Could not find that track on Spotify.")
                
            await send_spicetify_command(OWNER_ID, {"action": "play", "uri": track['uri']})
            await msg.edit(content=f"▶️ Sent **{track['name']}** by {', '.join(track['artists'])} to local Spotify!")

    @commands.command(name="lpause", aliases=["lps"])
    async def lpause(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "pause"})
        await ctx.send("⏸️ Sent **Pause** command to local Spotify.")

    @commands.command(name="lskip", aliases=["lnext", "ls"])
    async def lskip(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "next"})
        await ctx.send("⏭️ Sent **Skip** command to local Spotify.")

    @commands.command(name="lprev", aliases=["lprevious"])
    async def lprev(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "previous"})
        await ctx.send("⏮️ Sent **Previous** command to local Spotify.")

async def setup(bot):
    await bot.add_cog(LocalRemote(bot))
