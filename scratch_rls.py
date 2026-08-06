import asyncio, asyncpg, os
from dotenv import load_dotenv

load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    tables = await conn.fetch('''
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ''')
    
    for record in tables:
        table = record['tablename']
        print(f'Enabling RLS on {table}...')
        await conn.execute(f'ALTER TABLE public.\"{table}\" ENABLE ROW LEVEL SECURITY;')
        
    print('Done!')
    await conn.close()

asyncio.run(main())
