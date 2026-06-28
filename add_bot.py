import asyncio
import asyncpg
import os
import base64
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    token = os.getenv('DISCORD_TOKEN')
    bot_id = base64.b64decode(token.split('.')[0] + '==').decode()
    
    try:
        await conn.execute("""
            INSERT INTO user_settings (user_id, lastfm_username, discord_username, display_name) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (user_id) DO UPDATE 
            SET lastfm_username = EXCLUDED.lastfm_username, 
                discord_username = EXCLUDED.discord_username, 
                display_name = EXCLUDED.display_name
        """, bot_id, 'DjScratch', 'DJ Scratch', 'DJ Scratch')
        print("Success! Bot is in the database.")
    except Exception as e:
        print("Failed to insert:", e)
        
    await conn.close()

asyncio.run(main())
