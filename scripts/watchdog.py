import os
import sys
import psycopg2
import requests
from datetime import datetime, timedelta

def main():
    DATABASE_URL = os.getenv("DATABASE_URL")
    DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
    
    if not DATABASE_URL or not DISCORD_TOKEN:
        print("Missing DATABASE_URL or DISCORD_TOKEN")
        sys.exit(1)
        
    try:
        # Connect to DB
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Check heartbeat
        cur.execute("SELECT value FROM global_settings WHERE key = 'last_heartbeat'")
        row = cur.fetchone()
        
        if not row:
            print("No heartbeat found in database.")
            sys.exit(0)
            
        last_heartbeat_str = row[0]
        # Remove trailing 'Z' if present and parse ISO format
        last_heartbeat_str = last_heartbeat_str.replace('Z', '')
        last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
        
        # Check if heartbeat is older than 3 minutes
        if datetime.utcnow() - last_heartbeat > timedelta(minutes=3):
            print("Heartbeat is older than 3 minutes! Bot is offline.")
            
            # Fetch message coordinates
            cur.execute("SELECT value FROM global_settings WHERE key = 'status_channel_id'")
            channel_row = cur.fetchone()
            cur.execute("SELECT value FROM global_settings WHERE key = 'status_message_id'")
            message_row = cur.fetchone()
            
            if channel_row and message_row:
                channel_id = channel_row[0]
                message_id = message_row[0]
                
                # Edit Discord Message via REST API
                url = f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}"
                headers = {
                    "Authorization": f"Bot {DISCORD_TOKEN}",
                    "Content-Type": "application/json"
                }
                
                embed = {
                    "title": "<a:VinylRecord:1527125818713837701> DJ Scratch - System Status",
                    "description": "**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server or is currently restarting.*",
                    "color": 16711680, # Red
                    "footer": {
                        "text": "Watchdog Monitor"
                    },
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                
                res = requests.patch(url, headers=headers, json={"embeds": [embed]})
                if res.status_code == 200:
                    print("Successfully updated Discord message to OFFLINE state.")
                else:
                    print(f"Failed to update Discord message. Status: {res.status_code} - {res.text}")
            else:
                print("Missing status_channel_id or status_message_id in database.")
        else:
            print("Bot is online. Heartbeat is recent.")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
