import discord
from discord.ext import commands, tasks
import json
import os
import sys
from ..core.events import Log

IPC_CHANNEL_ID = 1517288950522187947

class AdminIPC(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.push_stats.start()

    def cog_unload(self):
        self.push_stats.cancel()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.channel.id != IPC_CHANNEL_ID:
            return
            
        if not message.content.startswith("[IPC]"):
            return
            
        action_payload = message.content[5:].strip()
        print(f"{Log.CYAN}>>> [IPC] Received action via Discord: {action_payload}{Log.RESET}")
        
        if action_payload == "RESTART_BOT":
            await message.add_reaction("✅")
            print(f"{Log.YELLOW}>>> [IPC] Restarting bot...{Log.RESET}")
            os.execv(sys.executable, ['python'] + sys.argv)
            
        elif action_payload == "SYNC_COMMANDS":
            try:
                synced = await self.bot.tree.sync()
                print(f"{Log.GREEN}>>> Synced {len(synced)} commands via IPC!{Log.RESET}")
                await message.add_reaction("✅")
            except Exception as e:
                print(f"{Log.RED}>>> Sync failed: {e}{Log.RESET}")
                await message.add_reaction("❌")
                
        elif action_payload == "CLEAR_DUPLICATES":
            await message.add_reaction("✅")
            print(f"{Log.GREEN}>>> [IPC] Cleared duplicates (dummy).{Log.RESET}")
            
        elif action_payload.startswith("SET_GLOBAL_UPDATE|"):
            parts = action_payload.split("|", 2)
            if len(parts) == 3:
                version = parts[1]
                msg_content = parts[2]
                from ..core.events import CACHED_GLOBAL_UPDATE_VERSION, CACHED_GLOBAL_UPDATE_MESSAGE
                import src.core.events as events_module
                events_module.CACHED_GLOBAL_UPDATE_VERSION = version
                events_module.CACHED_GLOBAL_UPDATE_MESSAGE = msg_content
                print(f"{Log.GREEN}>>> [IPC] Global update cache updated to {version}{Log.RESET}")
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
            print(f"{Log.RED}>>> [IPC] Stats push error: {e}{Log.RESET}")

    @push_stats.before_loop
    async def before_push_stats(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(AdminIPC(bot))
