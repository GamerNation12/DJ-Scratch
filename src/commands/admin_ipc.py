import discord
from discord.ext import commands, tasks
import json
import os
import sys
from ..core.database import db_pool
from ..core.events import Log

class AdminIPC(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.poll_actions.start()
        self.push_stats.start()

    def cog_unload(self):
        self.poll_actions.cancel()
        self.push_stats.cancel()

    @tasks.loop(seconds=5)
    async def poll_actions(self):
        global db_pool
        from ..core.events import db_pool
        if not db_pool:
            return
            
        try:
            async with db_pool.acquire() as conn:
                # Fetch pending actions
                records = await conn.fetch("SELECT id, action_type FROM bot_actions WHERE status = 'PENDING' ORDER BY created_at ASC")
                for record in records:
                    action_id = record['id']
                    action_type = record['action_type']
                    
                    print(f"{Log.CYAN}>>> [IPC] Received action: {action_type}{Log.RESET}")
                    
                    if action_type == 'SYNC_COMMANDS':
                        try:
                            synced = await self.bot.tree.sync()
                            print(f"{Log.GREEN}>>> Synced {len(synced)} commands via IPC!{Log.RESET}")
                            await conn.execute("UPDATE bot_actions SET status = 'COMPLETED' WHERE id = $1", action_id)
                        except Exception as e:
                            print(f"{Log.RED}>>> Sync failed: {e}{Log.RESET}")
                            await conn.execute("UPDATE bot_actions SET status = 'ERROR' WHERE id = $1", action_id)
                            
                    elif action_type == 'RESTART_BOT':
                        await conn.execute("UPDATE bot_actions SET status = 'COMPLETED' WHERE id = $1", action_id)
                        print(f"{Log.YELLOW}>>> [IPC] Restarting bot...{Log.RESET}")
                        os.execv(sys.executable, ['python'] + sys.argv)
                        
                    elif action_type == 'CLEAR_DUPLICATES':
                        # Dummy action for now
                        await conn.execute("UPDATE bot_actions SET status = 'COMPLETED' WHERE id = $1", action_id)
                        print(f"{Log.GREEN}>>> [IPC] Cleared duplicates (dummy).{Log.RESET}")
                        
                    else:
                        print(f"{Log.RED}>>> [IPC] Unknown action: {action_type}{Log.RESET}")
                        await conn.execute("UPDATE bot_actions SET status = 'ERROR' WHERE id = $1", action_id)
                        
        except Exception as e:
            print(f"{Log.RED}>>> [IPC] Polling error: {e}{Log.RESET}")

    @poll_actions.before_loop
    async def before_poll_actions(self):
        await self.bot.wait_until_ready()

    @tasks.loop(minutes=1)
    async def push_stats(self):
        global db_pool
        from ..core.events import db_pool
        if not db_pool:
            return
            
        try:
            # Gather stats
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
