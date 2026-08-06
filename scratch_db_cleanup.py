import asyncio
import sys
import os
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db

async def check():
    await init_db()
    import src.core.database
    pool = src.core.database.db_pool
    
    async with pool.acquire() as conn:
        rows = await conn.fetch('''
            SELECT relname as table_name, pg_size_pretty(pg_total_relation_size(relid)) as total_size,
            pg_total_relation_size(relid) as raw_size
            FROM pg_catalog.pg_statio_user_tables 
            ORDER BY pg_total_relation_size(relid) DESC;
        ''')
        for r in rows:
            print(f"{r['table_name']}: {r['total_size']}")
            
        print("\nTruncating log tables...")
        # Truncate tables that just store logs/history which might be very large
        await conn.execute("TRUNCATE TABLE website_logs;")
        await conn.execute("TRUNCATE TABLE command_usage;")
        await conn.execute("TRUNCATE TABLE bot_actions;")
        await conn.execute("TRUNCATE TABLE import_chunks;")
        print("Truncated website_logs, command_usage, bot_actions, import_chunks")

asyncio.run(check())
