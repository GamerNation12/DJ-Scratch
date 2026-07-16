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
    if getattr(bot, 'is_restarting', False):
        return
        
    if os.path.exists('.restart_flag'):
        print(f"[{bot.user.name}] Found .restart_flag! Initiating 1-minute graceful shutdown...")
        try:
            os.remove('.restart_flag')
        except:
            pass
            
        bot.is_restarting = True
        try:
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

@bot.listen('on_ready')
async def on_ready_monitor():
    if not memory_monitor.is_running():
        memory_monitor.start()
        print(f"\033[92mMemory monitor started.\033[0m")
        
    if not restart_watchdog.is_running():
        restart_watchdog.start()
        print(f"\033[92mRestart watchdog started.\033[0m")
        
    import json
    if os.path.exists('restart_notifs.json'):
        try:
            with open('restart_notifs.json', 'r') as f:
                users = json.load(f)
            for user_id in users:
                try:
                    user = await bot.fetch_user(user_id)
                    if user:
                        await user.send("✅ **The bot is back online!** The restart has been completed successfully.")
                except Exception as e:
                    print(f"Could not DM user {user_id} about restart: {e}")
            os.remove('restart_notifs.json')
        except Exception as e:
            print(f"Error processing restart_notifs.json: {e}")

load_dotenv()
if __name__ == "__main__":
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
    print("Starting DJ Scratch Bot...")
    bot.run(os.getenv("DISCORD_TOKEN"), log_level=logging.WARNING)