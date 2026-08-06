import asyncio
import sys
import os
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db, db_pool

async def check():
    await init_db()
    
    # Needs a fresh import after init_db because db_pool might be reassigned
    import src.core.database
    pool = src.core.database.db_pool
    
    if pool is None:
        print("db_pool is still None!")
        return
        
    async with pool.acquire() as conn:
        await conn.execute("DROP TABLE IF EXISTS direct_messages;")
        print("Table direct_messages dropped")

asyncio.run(check())
