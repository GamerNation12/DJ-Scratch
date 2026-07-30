import discord
from discord.ext import commands
from src.core.socket_server import send_spicetify_command
from src.core.spotify import search_spotify_track

# Hardcoded owner ID for the bot owner
OWNER_ID = 759433582107426816

class LocalRemote(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def cog_check(self, ctx):
        return ctx.author.id == OWNER_ID

    @commands.command(name="lplay", aliases=["lp"])
    async def lplay(self, ctx, *, query: str = None):
        embed = discord.Embed(color=0x1DB954)
        if not query:
            await send_spicetify_command(OWNER_ID, {"action": "play"})
            embed.description = "▶️ Sent **Resume** command to local Spotify."
            return await ctx.send(embed=embed)
            
        embed.description = f"🔍 Searching for `{query}`..."
        msg = await ctx.send(embed=embed)
        
        session = self.bot.session
        track = await search_spotify_track(session, query)
        
        if not track:
            embed.color = 0xFF0000
            embed.description = "❌ Could not find that track on Spotify."
            return await msg.edit(embed=embed)
            
        await send_spicetify_command(OWNER_ID, {"action": "play", "uri": track['uri']})
        
        if track.get('album') and track['album'].get('images'):
            embed.set_thumbnail(url=track['album']['images'][0]['url'])
        embed.description = f"▶️ Sent **{track['name']}** by {', '.join(track['artists'])} to local Spotify!"
        await msg.edit(embed=embed)

    @commands.command(name="lpause", aliases=["lps"])
    async def lpause(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "pause"})
        embed = discord.Embed(color=0x1DB954, description="⏸️ Sent **Pause** command to local Spotify.")
        await ctx.send(embed=embed)

    @commands.command(name="lskip", aliases=["lnext", "ls"])
    async def lskip(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "next"})
        embed = discord.Embed(color=0x1DB954, description="⏭️ Sent **Skip** command to local Spotify.")
        await ctx.send(embed=embed)

    @commands.command(name="lprev", aliases=["lprevious"])
    async def lprev(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "previous"})
        embed = discord.Embed(color=0x1DB954, description="⏮️ Sent **Previous** command to local Spotify.")
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(LocalRemote(bot))
