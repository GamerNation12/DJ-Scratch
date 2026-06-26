import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv('.env')

async def main():
    db_conn_string = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    pool = await asyncpg.create_pool(db_conn_string)
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, discord_username, display_name FROM user_settings WHERE display_name IS NOT NULL")
        for r in rows:
            print(dict(r))

asyncio.run(main())
