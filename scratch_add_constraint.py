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
        print("Adding unique constraint...")
        await conn.execute('ALTER TABLE listens ADD CONSTRAINT listens_user_track_played_at_key UNIQUE (user_id, track_id, played_at);')
        print('Added unique constraint')

asyncio.run(run())
