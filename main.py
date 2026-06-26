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

@bot.listen('on_ready')
async def on_ready_monitor():
    if not memory_monitor.is_running():
        memory_monitor.start()
        print(f"\033[92mMemory monitor started.\033[0m")

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
    print("Starting the Goats DJ Bot...")
    bot.run(os.getenv("DISCORD_TOKEN"), log_level=logging.WARNING)