import asyncio
import sys
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db

async def check():
    await init_db()
    import src.core.database
    pool = src.core.database.db_pool
    
    async with pool.acquire() as conn:
        schema = await conn.fetch('''
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'listens';
        ''')
        for r in schema:
            print(f"{r['column_name']}: {r['data_type']}")
        
        # Also check the number of rows
        count = await conn.fetchval("SELECT COUNT(*) FROM listens;")
        print(f"Total rows in listens: {count}")

asyncio.run(check())
