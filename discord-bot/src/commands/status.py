import discord
from discord.ext import commands, tasks
import psutil
import time
from datetime import datetime, timedelta
from src.core.theme import Theme
from src.core.database import get_global_setting, set_global_setting

class StatusCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.process = psutil.Process()
        self.status_loop.start()

    def cog_unload(self):
        self.status_loop.cancel()

    @commands.command(name="setstatus", hidden=True)
    @commands.is_owner()
    async def setstatus(self, ctx):
        embed = self.build_status_embed(offline=False)
        msg = await ctx.send(embed=embed)
        
        await set_global_setting('status_channel_id', str(ctx.channel.id))
        await set_global_setting('status_message_id', str(msg.id))
        
        await ctx.send("✅ Status monitoring channel set! The message above will now update every minute.", delete_after=5)

    def build_status_embed(self, offline=False):
        if offline:
            embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - System Status", color=discord.Color.red(), timestamp=discord.utils.utcnow())
            embed.description = "**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server or is currently restarting.*"
            embed.set_footer(text="Watchdog Monitor")
            return embed
            
        embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - System Status", color=discord.Color.green(), timestamp=discord.utils.utcnow())
        embed.description = "**🟢 STATUS: ONLINE**"
        
        # Calculate uptime
        uptime = time.time() - self.process.create_time()
        uptime_td = timedelta(seconds=uptime)
        days = uptime_td.days
        hours, remainder = divmod(uptime_td.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m {seconds}s"
        
        # Ping
        ping = round(self.bot.latency * 1000)
        
        # Guilds and members
        server_count = len(self.bot.guilds)
        total_members = sum(g.member_count for g in self.bot.guilds if g.member_count)
        
        # Resources
        cpu_usage = self.process.cpu_percent()
        ram_usage_bytes = self.process.memory_info().rss
        ram_usage_mb = ram_usage_bytes / (1024 * 1024)
        
        embed.add_field(name="🟢 Uptime", value=f"`{uptime_str}`", inline=True)
        embed.add_field(name="🏓 Ping", value=f"`{ping}ms`", inline=True)
        embed.add_field(name="🌐 Servers", value=f"`{server_count:,}`", inline=True)
        
        embed.add_field(name="👥 Users", value=f"`{total_members:,}`", inline=True)
        embed.add_field(name="💻 CPU Usage", value=f"`{cpu_usage}%`", inline=True)
        embed.add_field(name="💾 RAM Usage", value=f"`{ram_usage_mb:.1f} MB`", inline=True)
        
        embed.set_footer(text="Live Updating Dashboard • Last Updated")
        return embed

    @tasks.loop(minutes=1)
    async def status_loop(self):
        await self.bot.wait_until_ready()
        try:
            # 1. Update heartbeat
            now = datetime.utcnow().isoformat()
            await set_global_setting('last_heartbeat', now)
            
            # 2. Fetch channel and message ID
            channel_id = await get_global_setting('status_channel_id')
            message_id = await get_global_setting('status_message_id')
            
            if channel_id and message_id:
                channel = self.bot.get_channel(int(channel_id))
                if channel:
                    try:
                        msg = await channel.fetch_message(int(message_id))
                        embed = self.build_status_embed(offline=False)
                        await msg.edit(embed=embed)
                    except discord.NotFound:
                        # Message was deleted
                        pass
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in status loop: {e}{Log.RESET}")

async def setup(bot):
    await bot.add_cog(StatusCog(bot))
