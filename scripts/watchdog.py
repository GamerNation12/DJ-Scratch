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
        
        force_crash = "--force-crash" in sys.argv
        
        # Check if heartbeat is older than 3 minutes or force crashed
        if force_crash or datetime.utcnow() - last_heartbeat > timedelta(minutes=3):
            print("Bot is offline or crashed!")
            
            # Fetch message coordinates
            cur.execute("SELECT value FROM global_settings WHERE key = 'status_messages'")
            messages_row = cur.fetchone()
            
            if messages_row and messages_row[0]:
                import json
                try:
                    messages = json.loads(messages_row[0])
                except Exception as e:
                    print(f"Error parsing status_messages JSON: {e}")
                    messages = []
                
                embed = {
                    "title": "<a:VinylRecord:1527125818713837701> DJ Scratch - System Status",
                    "description": "**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server.*",
                    "color": 16711680, # Red
                    "footer": {
                        "text": "Watchdog Monitor"
                    },
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                
                for item in messages:
                    channel_id = item.get("channel_id")
                    message_id = item.get("message_id")
                    
                    if channel_id and message_id:
                        # Edit Discord Message via REST API
                        url = f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}"
                        headers = {
                            "Authorization": f"Bot {DISCORD_TOKEN}",
                            "Content-Type": "application/json"
                        }
                        
                        res = requests.patch(url, headers=headers, json={"embeds": [embed]})
                        if res.status_code == 200:
                            print(f"Successfully updated message {message_id} to OFFLINE state.")
                        else:
                            print(f"Failed to update {message_id}. Status: {res.status_code} - {res.text}")
            else:
                print("Missing status_messages in database.")
        else:
            print("Bot is online. Heartbeat is recent.")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
