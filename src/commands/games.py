import discord
from discord.ext import commands
import random
import io
from PIL import Image
from ..utils.api import fetch_top_artists, fetch_top_tracks

class GamesCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="pixel")
    async def pixel_prefix(self, ctx):
        from ..core.events import get_lastfm_username
        from ..utils.api import fetch_top_albums
        import aiohttp

        username = await get_lastfm_username(ctx.author.id)
        if not username:
            await ctx.send("You need to link your Last.fm first using `,setfm [username]`!")
            return

        data = await fetch_top_albums(username, 'overall', 50)
        if not data or 'topalbums' not in data or not data['topalbums']['album']:
            await ctx.send("Not enough data to play pixel!")
            return

        albums = [a for a in data['topalbums']['album'] if a['image'][-1]['#text']]
        if not albums:
            await ctx.send("No album art found!")
            return
            
        target = random.choice(albums)
        album_name = target['name']
        artist_name = target['artist']['name']
        img_url = target['image'][-1]['#text']

        # Download and pixelate
        async with aiohttp.ClientSession() as session:
            async with session.get(img_url) as resp:
                if resp.status != 200:
                    return await ctx.send("Failed to download album art!")
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
        embed = discord.Embed(title="🖼️ Pixelated Album", description="Guess the album name or artist!\nYou have 30 seconds.", color=Theme.PRIMARY)
        embed.set_image(url="attachment://pixel.png")
        await ctx.send(embed=embed, file=file)

        def check(m):
            return m.channel == ctx.channel and (m.content.lower() in album_name.lower() or m.content.lower() in artist_name.lower()) and len(m.content) > 3

        try:
            msg = await self.bot.wait_for('message', check=check, timeout=30.0)
            await ctx.send(f"🎉 **{msg.author.display_name}** got it! It was **{album_name}** by **{artist_name}**!")
        except asyncio.TimeoutError:
            await ctx.send(f"⏰ Time's up! It was **{album_name}** by **{artist_name}**.")

    @commands.command(name="jumble")
    async def jumble_prefix(self, ctx):
        from ..core.events import get_lastfm_username
        username = await get_lastfm_username(ctx.author.id)
        if not username:
            await ctx.send("You need to link your Last.fm first using `,setfm [username]`!")
            return

        # Fetch top artists
        data = await fetch_top_artists(username, 'overall', 50)
        if not data or 'topartists' not in data or not data['topartists']['artist']:
            await ctx.send("Not enough data to play jumble!")
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
        embed = discord.Embed(title="🎵 Artist Jumble", description=f"Unscramble this artist name:\n\n**`{scrambled.upper()}`**\n\nYou have 30 seconds!", color=Theme.PRIMARY)
        await ctx.send(embed=embed)

        def check(m):
            return m.channel == ctx.channel and m.content.lower() == target.lower()

        try:
            msg = await self.bot.wait_for('message', check=check, timeout=30.0)
            await ctx.send(f"🎉 **{msg.author.display_name}** got it! The artist was **{target}**!")
        except asyncio.TimeoutError:
            await ctx.send(f"⏰ Time's up! The artist was **{target}**.")

async def setup(bot):
    await bot.add_cog(GamesCog(bot))
