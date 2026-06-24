import asyncio
import os
from dotenv import load_dotenv
load_dotenv('web/.env.local')
from src.core.database import init_db, db_pool

async def main():
    await init_db()
    if not db_pool:
        print("No db pool")
        return
    
    async with db_pool.acquire() as conn:
        try:
            await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discord_username TEXT")
            print("Added discord_username column")
            
            # Map existing users if we know them
            await conn.execute("UPDATE user_settings SET discord_username = 'GamerNation12' WHERE lastfm_username = 'GamerNation13'")
            print("Mapped GamerNation12")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
