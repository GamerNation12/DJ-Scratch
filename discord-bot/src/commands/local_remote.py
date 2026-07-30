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

    def format_embed(self, embed, track):
        embed.set_author(name="Spotify remote – Now playing", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        embed.title = track['name']
        if track.get('spotify_url'):
            embed.url = track['spotify_url']
        artists = ", ".join(track['artists'])
        album = track.get('album_name') or "Unknown Album"
        embed.description = f"**{artists}** • *{album}*"
        return embed

    @commands.command(name="lplay", aliases=["lp"])
    async def lplay(self, ctx, *, query: str = None):
        embed = discord.Embed(color=0x1DB954)
        if not query:
            await send_spicetify_command(OWNER_ID, {"action": "play"})
            embed.set_author(name="Spotify remote – Now playing", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
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
        
        embed.description = ""
        embed = self.format_embed(embed, track)
        await msg.edit(embed=embed)

    @commands.command(name="lpause", aliases=["lps"])
    async def lpause(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "pause"})
        embed = discord.Embed(color=0x1DB954)
        embed.set_author(name="Spotify remote – Paused", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        await ctx.send(embed=embed)

    @commands.command(name="lskip", aliases=["lnext", "ls"])
    async def lskip(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "next"})
        embed = discord.Embed(color=0x1DB954)
        embed.set_author(name="Spotify remote – Skipped", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        await ctx.send(embed=embed)

    @commands.command(name="lprev", aliases=["lprevious"])
    async def lprev(self, ctx):
        await send_spicetify_command(OWNER_ID, {"action": "previous"})
        embed = discord.Embed(color=0x1DB954)
        embed.set_author(name="Spotify remote – Previous", icon_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png")
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(LocalRemote(bot))
