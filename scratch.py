import asyncio
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    db_url = os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL')
    if not db_url:
        print("No DB URL")
        return
    conn = await asyncpg.connect(db_url)
    row = await conn.fetchrow('SELECT * FROM listens LIMIT 1;')
    print(dict(row))
    await conn.close()

asyncio.run(main())
