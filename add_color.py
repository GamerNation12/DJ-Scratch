import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv('.env')

sys.path.insert(0, 'discord-bot')
import src.core.database as db

async def main():
    await db.init_db()
    async with db.db_pool.acquire() as conn:
        try:
            await conn.execute('ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embed_color TEXT;')
            print('Added embed_color column')
        except Exception as e:
            print(e)
            
asyncio.run(main())
