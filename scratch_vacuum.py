import asyncio
import sys
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db

async def run_vacuum():
    await init_db()
    import src.core.database
    pool = src.core.database.db_pool
    
    async with pool.acquire() as conn:
        print("Starting VACUUM FULL. This forces the database to immediately rewrite itself and reclaim disk space.")
        print("This might take a few minutes...")
        
        # asyncpg does not allow VACUUM inside a transaction block, 
        # but execute() outside a transaction block should work.
        try:
            await conn.execute('VACUUM FULL;')
            print("VACUUM FULL completed successfully! Disk space is reclaimed.")
        except Exception as e:
            print(f"Error running VACUUM FULL: {e}")

asyncio.run(run_vacuum())
