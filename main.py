import os
import sys
import psutil
from discord.ext import tasks

os.system("pip install PyNaCl")
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
        print("Memory monitor started.")

load_dotenv()
if __name__ == "__main__":
    import logging
    log = logging.getLogger("discord.bot")
    log.info("Starting the Goats DJ Bot...")
    bot.run(os.getenv("DISCORD_TOKEN"))
