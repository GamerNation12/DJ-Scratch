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
        
        embed = discord.Embed(title="🤖 Bot Status", color=Theme.PRIMARY, timestamp=datetime.utcnow())
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
        import aiohttp
        from datetime import timezone
        
        embed = discord.Embed(title="<a:VinylRecord:1520654501365678190> DJ Scratch - Latest Updates", color=Theme.PRIMARY, timestamp=datetime.now(timezone.utc))
        
        try:
            async with aiohttp.ClientSession() as session:
                # Fetch recent commits from GitHub API
                async with session.get("https://api.github.com/repos/GamerNation12/DJ-Scratch/commits") as resp:
                    if resp.status == 200:
                        commits = await resp.json()
                        # Show the 5 most recent commits
                        for commit in commits[:5]:
                            message = commit['commit']['message']
                            title = message.split('\n')[0] # Get just the first line
                            
                            if len(title) > 250:
                                title = title[:247] + "..."
                                
                            date_str = commit['commit']['author']['date']
                            date_obj = datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                            timestamp = f"<t:{int(date_obj.timestamp())}:R>"
                            
                            sha_short = commit['sha'][:7]
                            url = commit['html_url']
                            
                            embed.add_field(
                                name=f"🔨 {title}", 
                                value=f"[{sha_short}]({url}) • {timestamp}",
                                inline=False
                            )
                    else:
                        embed.description = "❌ Could not fetch recent updates from GitHub."
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

async def setup(bot):
    await bot.add_cog(InfoCog(bot))
