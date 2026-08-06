import asyncio, asyncpg, os
from dotenv import load_dotenv

load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    await conn.execute('''
        CREATE TABLE IF NOT EXISTS disabled_commands (
            command_name TEXT PRIMARY KEY,
            reason TEXT,
            disabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            disabled_by TEXT
        );
    ''')
    
    # Enable RLS on this new table
    await conn.execute('ALTER TABLE public.disabled_commands ENABLE ROW LEVEL SECURITY;')
    
    print('disabled_commands table created successfully')
    await conn.close()

asyncio.run(main())
