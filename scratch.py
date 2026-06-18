import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn_str = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not conn_str:
        print("No DB URL")
        return
        
    try:
        conn = await asyncpg.connect(conn_str)
        try:
            await conn.execute("ALTER TABLE user_settings ADD COLUMN update_notifs BOOLEAN DEFAULT TRUE")
            print("Successfully added update_notifs")
        except Exception as e:
            print(f"Error adding update_notifs: {type(e).__name__} - {e}")
            
        try:
            await conn.execute("ALTER TABLE user_settings ADD COLUMN last_update_seen TEXT DEFAULT ''")
            print("Successfully added last_update_seen")
        except Exception as e:
            print(f"Error adding last_update_seen: {type(e).__name__} - {e}")
            
        await conn.close()
    except Exception as e:
        print(f"Connection error: {e}")

asyncio.run(main())
