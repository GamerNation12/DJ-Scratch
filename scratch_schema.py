import asyncio, asyncpg, os
from dotenv import load_dotenv

load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    rows = await conn.fetch('''
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'command_permissions'
    ''')
    
    for row in rows:
        print(f"{row['column_name']}: {row['data_type']}")
        
    await conn.close()

asyncio.run(main())
