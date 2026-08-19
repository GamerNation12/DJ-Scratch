import discord
from discord.ext import commands
from discord import app_commands
import psutil
import time
from datetime import datetime, timedelta
from src.core.theme import Theme

from src.core.database import format_name


class InfoCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.process = psutil.Process()

    @app_commands.command(name="status", description="Displays bot's live stats, uptime, and performance metrics")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        
        is_owner = await self.bot.is_owner(interaction.user)
        if is_owner:
            msg = await interaction.followup.send("📊 Fetching global database metrics... (this may take a few seconds)", wait=True)
            
            guilds = sorted(self.bot.guilds, key=lambda g: g.member_count or 0, reverse=True)
            total_servers = len(guilds)
            total_members = sum(g.member_count for g in guilds if g.member_count)
            
            db_size = "Unknown"
            scrobbles = 0
            users = 0
            crowns = 0
            
            if getattr(self.bot, 'db_pool', None):
                async with self.bot.db_pool.acquire() as conn:
                    try:
                        scrobbles = await conn.fetchval("SELECT reltuples::bigint FROM pg_class WHERE relname = 'listens'")
                        users = await conn.fetchval("SELECT COUNT(*) FROM user_settings")
                        crowns = await conn.fetchval("SELECT COUNT(*) FROM server_crowns")
                        db_size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size(current_database()))")
                    except Exception as e:
                        print(f"Stats DB Error: {e}")
                        
            cpu_usage = self.process.cpu_percent()
            ram_usage = psutil.virtual_memory().percent
            
            uptime_seconds = int(time.time() - self.process.create_time())
            uptime_str = str(timedelta(seconds=uptime_seconds))
            
            try:
                ping = round(self.bot.latency * 1000)
            except:
                ping = 0
                
            desc_lines = []
            for idx, guild in enumerate(guilds[:10], 1):
                desc_lines.append(f"`{idx:02}.` **{guild.name}** • 👥 **{guild.member_count:,}**")
                
            if len(guilds) > 10:
                desc_lines.append(f"\n*...and {len(guilds) - 10} more servers.*")
                
            embed = discord.Embed(
                title="📊 Global System & Database Dashboard",
                color=Theme.PRIMARY
            )
            
            embed.add_field(name="🗄️ Database Metrics", value=f"**Scrobbles:** `{scrobbles:,}`\n**Crowns:** `{crowns:,}`\n**DB Size:** `{db_size}`", inline=True)
            embed.add_field(name="👥 User Statistics", value=f"**Users Tracked:** `{users:,}`\n**Total Servers:** `{total_servers:,}`\n**Total Reach:** `{total_members:,}`", inline=True)
            embed.add_field(name="🤖 Bot Health", value=f"**Uptime:** `{uptime_str}`\n**Ping:** `{ping}ms`\n**CPU/RAM:** `{cpu_usage}% / {ram_usage}%`", inline=True)
            
            embed.add_field(name="🌐 Top 10 Largest Servers", value=chr(10).join(desc_lines) if desc_lines else "None", inline=False)
            embed.set_thumbnail(url=self.bot.user.display_avatar.url)
            
            await msg.edit(content=None, embed=embed)
            return

        # Ping
        ping = round(self.bot.latency * 1000)
        
        # Uptime
        uptime_seconds = int(time.time() - self.process.create_time())
        uptime_str = str(timedelta(seconds=uptime_seconds))
        
        # CPU and Memory
        cpu_usage = self.process.cpu_percent()
        ram_usage_mb = self.process.memory_info().rss / 1024 / 1024
        
        # Servers and Users
        server_count = len(self.bot.guilds)
        total_members = sum(g.member_count for g in self.bot.guilds if g.member_count)
        
        embed = Theme.get_embed(title="🤖 Bot Status", user=interaction.user)
        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        
        embed.add_field(name="🟢 Uptime", value=f"`{uptime_str}`", inline=True)
        embed.add_field(name="🏓 Ping", value=f"`{ping}ms`", inline=True)
        embed.add_field(name="🌐 Servers", value=f"`{server_count:,}`", inline=True)
        
        embed.add_field(name="👥 Users", value=f"`{total_members:,}`", inline=True)
        embed.add_field(name="💻 CPU Usage", value=f"`{cpu_usage}%`", inline=True)
        embed.add_field(name="💾 RAM Usage", value=f"`{ram_usage_mb:.1f} MB`", inline=True)
        
        embed.set_footer(text="Powered by fps.ms Pterodactyl hosting")
        
        await interaction.followup.send(embed=embed)

    async def send_updates(self, context):
        from src.core.database import get_global_update_version, get_global_update_message
        
        user = context.author if isinstance(context, commands.Context) else context.user
        embed = Theme.get_embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - Latest Updates", user=user, timestamp=discord.utils.utcnow())
        
        try:
            version = await get_global_update_version()
            message = await get_global_update_message()
            
            if version and message:
                embed.add_field(name=f"Update {version}", value=message, inline=False)
            else:
                embed.description = "No recent updates found."
        except Exception as e:
            embed.description = f"❌ Error fetching updates: {e}"

        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        embed.set_footer(text=Theme.FOOTER_TEXT)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="updates", description="Displays the latest bot updates and features")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def updates_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_updates(interaction)

    @commands.command(name="updates", aliases=["changelog", "news", "up", "u"])
    async def updates_prefix(self, ctx):
        await self.send_updates(ctx)

    async def send_outofsync(self, context):
        user = context.author if isinstance(context, commands.Context) else context.user
        
        from src.core.events import get_lastfm_username
        username = await get_lastfm_username(user.id)
        
        lastfm_link = f"[your Last.fm account](https://www.last.fm/user/{username})" if username else "your Last.fm account"
        
        time_str = ""
        if username:
            from src.utils.api import fetch_now_playing
            data = await fetch_now_playing(username, 2)
            if data and 'recenttracks' in data and 'track' in data['recenttracks'] and data['recenttracks']['track']:
                tracks = data['recenttracks']['track']
                t = tracks[0]
                if t.get('@attr', {}).get('nowplaying') == 'true':
                    time_str = " right now! (Your scrobbles seem to be working)"
                elif 'date' in t and 'uts' in t['date']:
                    uts = int(t['date']['uts'])
                    time_str = f" <t:{uts}:t>, about <t:{uts}:R>"
        
        if not time_str:
            time_str = " an unknown time ago"
            
        embed = Theme.get_embed(title="Using Spotify and tracking is out of sync?", user=user)
        
        desc = f"DJ Scratch uses {lastfm_link} for knowing what you listen to. The last scrobble on your profile was{time_str}.\n\n"
        desc += "**DJ Scratch is not affiliated with Last.fm.** Sync and scrobbling issues are Last.fm issues and **not DJ Scratch issues**, so [we can't fix them for you](https://support.last.fm/t/spotify-has-stopped-scrobbling-what-can-i-do/3184).\n\n"
        desc += "**Spotify stopped scrobbling completely?**\n"
        desc += "Spotify expires the Last.fm connection every 6 months. Press **Disconnect** and then **Connect** next to 'Spotify Scrobbling' in [your Last.fm settings](https://www.last.fm/settings/applications).\n\n"
        desc += "**Still not working after reconnecting?**\n"
        desc += "Try restarting your Spotify client. Sometimes there's also other issues with Last.fm or Spotify that can cause this. For a comprehensive list of all solutions, please check [the guide on the Last.fm support forums](https://support.last.fm/t/spotify-has-stopped-scrobbling-what-can-i-do/3184)."
        
        embed.description = desc
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="outofsync", description="Fix missing Spotify scrobbles on Last.fm")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def outofsync_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_outofsync(interaction)

    @commands.command(name="outofsync", aliases=["spotifyauth", "missing"])
    async def outofsync_prefix(self, ctx):
        await self.send_outofsync(ctx)

    async def send_guide(self, context):
        if isinstance(context, discord.TextChannel):
            user = None
        else:
            user = context.author if isinstance(context, commands.Context) else context.user
        embed = Theme.get_embed(
            title="🚀 Getting Started with DJ Scratch",
            description="Welcome to DJ Scratch! Here is a quick guide on how to get started.",
            user=user
        )
        embed.add_field(
            name="1️⃣ Link your Last.fm for Stats",
            value="To track your stats, you need to link your Last.fm account. Use the `/login` command and click the link to authenticate safely.",
            inline=False
        )
        embed.add_field(
            name="2️⃣ Listen to Music",
            value="Start playing music on Spotify or Apple Music! (Make sure your Last.fm account is connected to your music app in the Last.fm settings).",
            inline=False
        )
        embed.add_field(
            name="3️⃣ View your Current Song",
            value="Type `,fm` or `/fm` in any channel to display the song you are currently listening to, along with your playcount and server stats!",
            inline=False
        )
        embed.add_field(
            name="4️⃣ Explore More Commands",
            value="Try `,ta` to see your top artists, `,tt` for top tracks, or `,wk <artist>` to see who in the server listens to an artist the most!",
            inline=False
        )
        embed.add_field(
            name="Need more help?",
            value="Type `/help` to view the full command menu and explore everything DJ Scratch has to offer.",
            inline=False
        )
        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        embed.set_footer(text=Theme.FOOTER_TEXT)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="guide", description="A quick guide on how to start using the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def guide_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_guide(interaction)

    @commands.command(name="guide", aliases=["start", "tutorial", "howto"])
    async def guide_prefix(self, ctx):
        await self.send_guide(ctx)

    async def send_premium(self, context):
        user = context.author if isinstance(context, commands.Context) else context.user
        
        embed = Theme.get_premium_embed(
            title="Premium Upgrade (Coming Soon!)",
            description="DJ Scratch Premium is currently in development! Upgrade your music experience to the absolute max with these upcoming features:",
            user=user
        )
        embed.add_field(
            name="⚡ Zero Cooldowns",
            value="Spam commands as fast as you want with no global or user limits.",
            inline=False
        )
        embed.add_field(
            name="📊 Advanced Statistics",
            value="View deep insights into your listening habits over custom timeframes.",
            inline=False
        )
        embed.add_field(
            name="🎨 Custom Profiles",
            value="Fully customize your Last.fm profile card with custom backgrounds and badge colors.",
            inline=False
        )
        embed.add_field(
            name="🤖 Enhanced AI Judging",
            value="Unlock deeper, more brutal AI roasts with premium-tier models.",
            inline=False
        )
        
        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="premium", description="Preview upcoming premium features!")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def premium_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_premium(interaction)

    @commands.command(name="premium", aliases=["upgrade", "pro"])
    async def premium_prefix(self, ctx):
        await self.send_premium(ctx)

async def setup(bot):
    await bot.add_cog(InfoCog(bot))
