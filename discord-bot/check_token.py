import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    pool = await asyncpg.create_pool(os.getenv('DATABASE_URL'))
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT spotify_access_token FROM user_settings WHERE user_id = $1", '759433582107426816')
        print("Token exists" if row and row['spotify_access_token'] else "No token")

if __name__ == '__main__':
    asyncio.run(run())
