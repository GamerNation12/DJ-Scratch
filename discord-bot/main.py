import os
import sys
import psutil
from discord.ext import tasks

os.system(f"{sys.executable} -m pip install --upgrade pip")
os.system(f"{sys.executable} -m pip install PyNaCl")
from src.core.events import bot
from dotenv import load_dotenv

@tasks.loop(minutes=1)
async def memory_monitor():
    if getattr(bot, 'is_test_bot', False): return
    try:
        # Check overall system RAM usage percentage
        ram_percent = psutil.virtual_memory().percent
        
        # If RAM usage is 90% or higher, auto-restart to prevent crashing
        if ram_percent >= 90.0:
            print(f"CRITICAL: System RAM usage is at {ram_percent}%. Auto-restarting bot...")
            try:
                owner = await bot.fetch_user(759433582107426816)
                if owner:
                    await owner.send(f"🚨 **CRITICAL ALERT:** System RAM usage reached **{ram_percent}%**.\\nThe bot is now auto-restarting to prevent a crash.")
            except Exception as e:
                print(f"Failed to DM owner: {e}")
            os._exit(0)
    except Exception as e:
        print(f"Error in memory monitor: {e}")

@tasks.loop(seconds=5)
async def restart_watchdog():
    if getattr(bot, 'is_test_bot', False): return
    if getattr(bot, 'is_restarting', False):
        return
        
    if os.path.exists('.restart_flag'):
        print(f"[{bot.user.name}] Found .restart_flag! Initiating 1-minute graceful shutdown...")
        try:
            os.remove('.restart_flag')
        except:
            pass
            
        import time
        bot.is_restarting = time.time() + 60
        bot.restart_reason = "Applying new updates"
        try:
            status_cog = bot.get_cog("StatusCog")
            if status_cog:
                await status_cog.force_update_statuses()
                
            import discord
            await bot.change_presence(
                status=discord.Status.do_not_disturb, 
                activity=discord.Game(name="Restarting in 1 min...")
            )
        except Exception:
            pass
            
        import asyncio
        await asyncio.sleep(60)
        
        if getattr(bot, 'session', None):
            await bot.session.close()
        await bot.close()
        os._exit(0)

@tasks.loop(hours=24)
async def inactive_purge_task():
    if getattr(bot, 'is_test_bot', False): return
    from src.core.events import run_inactive_purge
    await run_inactive_purge()

@bot.listen('on_ready')
async def on_ready_monitor():
    if not memory_monitor.is_running():
        memory_monitor.start()
        print(f"\033[92mMemory monitor started.\033[0m")
        
    if not restart_watchdog.is_running():
        restart_watchdog.start()
        print(f"\033[92mRestart watchdog started.\033[0m")
        
    if not inactive_purge_task.is_running():
        inactive_purge_task.start()
        print(f"\033[92mInactive purge task started.\033[0m")
        
    from src.core.database import db_pool
    import json
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'restart_notifs'")
                if row and row['value']:
                    try:
                        users = json.loads(row['value'])
                        if users:
                            channel_notifs = {}
                            for item in users:
                                if isinstance(item, dict):
                                    c_id = item.get("channel_id")
                                    u_id = item.get("user_id")
                                    if c_id and u_id:
                                        if c_id not in channel_notifs:
                                            channel_notifs[c_id] = []
                                        channel_notifs[c_id].append(u_id)
                            
                            for c_id, u_ids in channel_notifs.items():
                                try:
                                    channel = bot.get_channel(c_id)
                                    if channel:
                                        mentions = " ".join([f"<@{u}>" for u in u_ids])
                                        await channel.send(f"✅ **The bot is back online!** The restart has been completed successfully. {mentions}")
                                except Exception as e:
                                    print(f"Could not send restart notif in channel {c_id}: {e}")
                            await conn.execute("DELETE FROM global_settings WHERE key = 'restart_notifs'")
                    except Exception as e:
                        print(f"Error parsing restart_notifs JSON: {e}")
        except Exception as e:
            print(f"Error processing restart_notifs from DB: {e}")

load_dotenv()
if __name__ == "__main__":
    is_test = "--test" in sys.argv
    print("Cleaning up old temp files...")
    for f in os.listdir('.'):
        if f.startswith('temp_import_') or f.startswith('web_import_'):
            try:
                os.remove(f)
                print(f"Deleted old temp file: {f}")
            except Exception as e:
                print(f"Failed to delete {f}: {e}")
                
    import logging
    logging.getLogger().handlers.clear()
    
    token_env = "TEST_DISCORD_TOKEN" if is_test else "DISCORD_TOKEN"
    token = os.getenv(token_env)
    if not token:
        print(f"ERROR: {token_env} is not set in your .env file!")
        sys.exit(1)
        
    bot.is_test_bot = is_test
    bot.test_bot_process = None
        
    print(f"Starting DJ Scratch {'(TEST MODE) ' if is_test else ''}Bot...")
    bot.run(token, log_level=logging.WARNING)