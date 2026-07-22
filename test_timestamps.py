import asyncio, asyncpg, os, json
from dotenv import load_dotenv

async def main():
    load_dotenv('.env')
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    rows = await conn.fetch('SELECT id, timestamp FROM website_logs ORDER BY id DESC LIMIT 5')
    print(json.dumps([dict(r) for r in rows], default=str))
    await conn.close()

asyncio.run(main())
