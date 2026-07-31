import os
import sys
import time
import psycopg2
import subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv

def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    DATABASE_URL = os.getenv("DATABASE_URL")
    DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
    
    if not DATABASE_URL or not DISCORD_TOKEN:
        print("Missing DATABASE_URL or DISCORD_TOKEN")
        sys.exit(1)

    dummy_process = None
    dummy_bot_path = os.path.join(os.path.dirname(__file__), '..', 'discord-bot', 'dummy_bot.py')

    print("Watchdog Service started. Monitoring heartbeats...")

    while True:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            
            cur.execute("SELECT value FROM global_settings WHERE key = 'last_heartbeat'")
            row = cur.fetchone()
            
            if row:
                last_heartbeat_str = row[0].replace('Z', '')
                last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
                
                # Check if heartbeat is older than 2.5 minutes
                is_down = (datetime.utcnow() - last_heartbeat) > timedelta(minutes=2, seconds=30)
                
                if is_down:
                    if dummy_process is None:
                        print(f"[{datetime.utcnow().isoformat()}] Host is DOWN! Heartbeat is stale. Starting Dummy Bot...")
                        dummy_process = subprocess.Popen([sys.executable, dummy_bot_path])
                else:
                    if dummy_process is not None:
                        print(f"[{datetime.utcnow().isoformat()}] Host is UP! Fresh heartbeat detected. Stopping Dummy Bot...")
                        dummy_process.terminate()
                        dummy_process.wait()
                        dummy_process = None
            
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f"[{datetime.utcnow().isoformat()}] Database error: {e}")
            
        time.sleep(30) # Check every 30 seconds

if __name__ == "__main__":
    main()
