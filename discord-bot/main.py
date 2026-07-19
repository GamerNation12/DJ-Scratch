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
    from src.core.database import db_pool
    from datetime import datetime, timedelta, timezone
    if getattr(bot, 'is_restarting', False) or not db_pool:
        return
        
    try:
        async with db_pool.acquire() as conn:
            warning_cutoff = datetime.now(timezone.utc) - timedelta(days=53)
            to_warn = await conn.fetch(
                "SELECT user_id FROM user_settings WHERE last_active <= $1 AND purge_warning_sent = FALSE",
                warning_cutoff
            )
            for row in to_warn:
                uid = row['user_id']
                try:
                    user = await bot.fetch_user(int(uid))
                    if user:
                        await user.send("⚠️ **Account Inactivity Warning**\nYour DJ Scratch data hasn't been used in over 50 days. It will be permanently deleted in 7 days due to inactivity.\n\n*To cancel this deletion, simply run any command like `/fm` or `/stats`!*")
                except Exception:
                    pass
                await conn.execute("UPDATE user_settings SET purge_warning_sent = TRUE WHERE user_id = $1", uid)
                
            delete_cutoff = datetime.now(timezone.utc) - timedelta(days=60)
            to_delete = await conn.fetch(
                "SELECT user_id FROM user_settings WHERE last_active <= $1",
                delete_cutoff
            )
            for row in to_delete:
                uid = row['user_id']
                await conn.execute("DELETE FROM user_settings WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM command_permissions WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM friends WHERE user_id = $1 OR friend_id = $1", uid)
                await conn.execute("DELETE FROM website_logs WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM direct_messages WHERE sender_id = $1 OR receiver_id = $1", uid)
                
            if to_delete:
                print(f"Purged {len(to_delete)} inactive users.")
    except Exception as e:
        print(f"Error in inactive_purge_task: {e}")

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