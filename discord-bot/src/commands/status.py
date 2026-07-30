import discord
from discord.ext import commands, tasks
import psutil
import time
from datetime import datetime, timedelta
from src.core.theme import Theme
from src.core.database import get_global_setting, set_global_setting, get_total_linked_users

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
        view = await self.build_status_layout(offline=False)
        msg = await ctx.send(view=view)
        
        import json
        raw_msgs = await get_global_setting('status_messages')
        messages = []
        if raw_msgs:
            try:
                messages = json.loads(raw_msgs)
            except:
                pass
                
        messages.append({"channel_id": str(ctx.channel.id), "message_id": str(msg.id)})
        await set_global_setting('status_messages', json.dumps(messages))
        
        await ctx.send("✅ Status monitoring channel set! The message above will now update every minute.", delete_after=5)

    async def build_status_layout(self, offline=False):
        view = discord.ui.LayoutView()
        
        if offline:
            title = "<a:VinylRecord:1527125818713837701> DJ Scratch - System Status"
            desc = "**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server.*"
            section = discord.ui.Section(
                discord.ui.TextDisplay(title),
                discord.ui.TextDisplay(desc)
            )
            container = discord.ui.Container(section, accent_color=discord.Color.red())
            view.add_item(container)
            return view
            
        is_restarting = getattr(self.bot, 'is_restarting', False)
        color = discord.Color.gold() if is_restarting else discord.Color.green()
        
        if is_restarting:
            timestamp = int(self.bot.is_restarting) if isinstance(self.bot.is_restarting, float) else int(time.time() + 60)
            reason = getattr(self.bot, 'restart_reason', 'Maintenance')
            status_text = f"**🟡 STATUS: RESTARTING**\n*The bot is shutting down <t:{timestamp}:R> because: **{reason}**.*"
        else:
            status_text = "**🟢 STATUS: ONLINE**"
            
        # Calculate uptime
        uptime = time.time() - self.process.create_time()
        uptime_td = timedelta(seconds=uptime)
        days = uptime_td.days
        hours, remainder = divmod(uptime_td.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m {seconds}s"
        
        # Ping
        try:
            ping = round(self.bot.latency * 1000)
        except (OverflowError, ValueError, TypeError):
            ping = 0
        
        # Guilds and members
        server_count = len(self.bot.guilds)
        total_members = sum(g.member_count for g in self.bot.guilds if g.member_count)
        
        # Resources
        cpu_usage = self.process.cpu_percent()
        ram_usage_bytes = self.process.memory_info().rss
        ram_usage_mb = ram_usage_bytes / (1024 * 1024)
        
        total_linked_users = await get_total_linked_users()
        
        active_users_count = 0
        if hasattr(self.bot, 'active_users_dict'):
            current_time = time.time()
            self.bot.active_users_dict = {uid: t for uid, t in self.bot.active_users_dict.items() if current_time - t <= 300}
            active_users_count = len(self.bot.active_users_dict)
            
        stats_text = (
            f"**🟢 Uptime:** `{uptime_str}` | **🏓 Ping:** `{ping}ms` | **🌐 Servers:** `{server_count:,}`\n"
            f"**👥 Users:** `{total_members:,}` | **🎧 Bot Users:** `{total_linked_users:,}` | **⚡ Active Cmds (5m):** `{active_users_count:,}`\n"
            f"**💻 CPU Usage:** `{cpu_usage}%` | **💾 RAM Usage:** `{ram_usage_mb:.1f} MB`"
        )
        
        section = discord.ui.Section(
            discord.ui.TextDisplay("<a:VinylRecord:1527125818713837701> DJ Scratch - System Status"),
            discord.ui.TextDisplay(status_text),
            discord.ui.TextDisplay(stats_text)
        )
        
        container = discord.ui.Container(section, accent_color=color)
        view.add_item(container)
        return view

    async def force_update_statuses(self):
        if getattr(self.bot, 'is_test_bot', False): return
        try:
            import json
            raw_msgs = await get_global_setting('status_messages')
            if not raw_msgs:
                return
            messages = json.loads(raw_msgs)
            for item in messages:
                channel_id = item.get('channel_id')
                message_id = item.get('message_id')
                if channel_id and message_id:
                    channel = self.bot.get_channel(int(channel_id))
                    if channel:
                        try:
                            msg = await channel.fetch_message(int(message_id))
                            view = await self.build_status_layout(offline=False)
                            await msg.edit(embeds=[], view=view)
                        except Exception:
                            pass
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in force_update_statuses: {e}{Log.RESET}")

    @tasks.loop(minutes=1)
    async def status_loop(self):
        if getattr(self.bot, 'is_test_bot', False): return
        await self.bot.wait_until_ready()
        try:
            # 1. Update heartbeat
            now = datetime.utcnow().isoformat()
            await set_global_setting('last_heartbeat', now)
            
            # 2. Fetch status messages
            import json
            raw_msgs = await get_global_setting('status_messages')
            if not raw_msgs:
                return
                
            messages = []
            try:
                messages = json.loads(raw_msgs)
            except:
                return
                
            updated_messages = []
            changed = False
            
            for item in messages:
                channel_id = item.get('channel_id')
                message_id = item.get('message_id')
                
                if channel_id and message_id:
                    channel = self.bot.get_channel(int(channel_id))
                    if not channel:
                        try:
                            channel = await self.bot.fetch_channel(int(channel_id))
                        except Exception:
                            pass
                            
                    if channel:
                        try:
                            msg = await channel.fetch_message(int(message_id))
                            view = await self.build_status_layout(offline=False)
                            await msg.edit(embeds=[], view=view)
                            updated_messages.append(item)
                        except discord.NotFound:
                            changed = True # Message deleted
                        except Exception as e:
                            print(f"Error updating status message {message_id}: {e}")
                            updated_messages.append(item)
                    else:
                        changed = True # Channel deleted/inaccessible
                        
            if changed:
                await set_global_setting('status_messages', json.dumps(updated_messages))
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in status loop: {e}{Log.RESET}")

async def setup(bot):
    await bot.add_cog(StatusCog(bot))
