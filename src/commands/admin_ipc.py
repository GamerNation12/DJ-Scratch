import discord
from discord.ext import commands, tasks
import json
import os
import sys
from ..core.events import Log

from src.core.database import format_name


IPC_CHANNEL_ID = 1517288950522187947

class AdminIPC(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.last_log_id = None
        self.push_stats.start()
        self.poll_website_logs.start()

    def cog_unload(self):
        self.push_stats.cancel()
        self.poll_website_logs.cancel()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.channel.id != IPC_CHANNEL_ID:
            return
            
        if not message.content.startswith("[WEBSITE]"):
            return
            
        action_payload = message.content[9:].strip()
        print(f"{Log.CYAN}>>> [WEBSITE] Received action via Discord: {action_payload}{Log.RESET}")
        
        if action_payload == "RESTART_BOT":
            await message.add_reaction("✅")
            print(f"{Log.CYAN}>>> [WEBSITE] Restarting bot...{Log.RESET}")
            os.execv(sys.executable, ['python'] + sys.argv)
            
        elif action_payload == "SYNC_COMMANDS":
            try:
                synced = await self.bot.tree.sync()
                print(f"Synced {len(synced)} commands via WEBSITE!")
                await message.add_reaction("✅")
            except Exception as e:
                print(f"Sync failed: {e}")
                await message.add_reaction("❌")
                
        elif action_payload == "CLEAR_DUPLICATES":
            await message.add_reaction("✅")
            print(f"{Log.CYAN}>>> [WEBSITE] Cleared duplicates (dummy).{Log.RESET}")
            
        elif action_payload.startswith("SET_GLOBAL_UPDATE|"):
            parts = action_payload.split("|", 2)
            if len(parts) == 3:
                version = parts[1]
                msg_content = parts[2]
                from ..core.events import CACHED_GLOBAL_UPDATE_VERSION, CACHED_GLOBAL_UPDATE_MESSAGE
                import src.core.events as events_module
                events_module.CACHED_GLOBAL_UPDATE_VERSION = version
                events_module.CACHED_GLOBAL_UPDATE_MESSAGE = msg_content
                print(f"{Log.CYAN}>>> [WEBSITE] Global update cache updated to {version}{Log.RESET}")
                await message.add_reaction("✅")
            else:
                await message.add_reaction("❌")

    @tasks.loop(minutes=30)
    async def push_stats(self):
        global db_pool
        from ..core.events import db_pool
        if not db_pool:
            return
            
        try:
            servers = []
            for g in self.bot.guilds:
                servers.append({
                    "name": g.name,
                    "member_count": g.member_count,
                    "icon": g.icon.url if g.icon else None
                })
                
            bot_stats = {
                "server_count": len(self.bot.guilds),
                "member_count": sum(g.member_count for g in self.bot.guilds if g.member_count),
                "servers": sorted(servers, key=lambda x: x['member_count'], reverse=True)
            }
            
            async with db_pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO global_settings (key, value) VALUES ('bot_stats', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    json.dumps(bot_stats)
                )
        except Exception as e:
            print(f"[IPC] Stats push error: {e}")

    @push_stats.before_loop
    async def before_push_stats(self):
        await self.bot.wait_until_ready()

    @tasks.loop(seconds=15)
    async def poll_website_logs(self):
        global db_pool
        from ..core.events import db_pool, log_to_channel
        if not db_pool:
            return
            
        try:
            async with db_pool.acquire() as conn:
                if self.last_log_id is None:
                    # On first run, just get the max ID so we don't spam old logs
                    row = await conn.fetchrow("SELECT MAX(id) FROM website_logs")
                    self.last_log_id = row[0] if row and row[0] else 0
                    return
                
                rows = await conn.fetch("SELECT id, user_id, username, action, details, timestamp FROM website_logs WHERE id > $1 ORDER BY id ASC", self.last_log_id)
                for row in rows:
                    log_id = row['id']
                    self.last_log_id = max(self.last_log_id, log_id)
                    
                    embed = discord.Embed(
                        title="🌐 Website Activity",
                        color=discord.Color.blue(),
                        timestamp=row['timestamp']
                    )
                    embed.add_field(name="User", value=f"{row['username']} (`{row['user_id']}`)", inline=False)
                    embed.add_field(name="Action", value=f"**{row['action']}**", inline=False)
                    embed.add_field(name="Details", value=row['details'] or "None", inline=False)
                    
                    await log_to_channel("website-log", embed)
                    
        except Exception as e:
            print(f"[IPC] Website logs poll error: {e}")

    @poll_website_logs.before_loop
    async def before_poll_website_logs(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(AdminIPC(bot))
