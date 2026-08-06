import asyncio
import sys
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db

async def run():
    await init_db()
    import src.core.database
    pool = src.core.database.db_pool
    
    async with pool.acquire() as conn:
        count = await conn.fetchval('SELECT COUNT(*) FROM listens;')
        count2 = await conn.fetchval('SELECT COUNT(*) FROM listens WHERE user_id = $1;', '759433582107426816')
        print(f"Total listens: {count}")
        print(f"User listens: {count2}")

asyncio.run(run())
