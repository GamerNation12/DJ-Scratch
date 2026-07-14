import asyncio
import asyncpg
import os

async def main():
    db_url = "postgresql://postgres.iuswdculretmygbseltt:GamerDoop7%21%26@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
    conn = await asyncpg.connect(db_url)
    val = await conn.fetchval("SELECT value FROM global_settings WHERE key='bot_status'")
    print("Bot status (artist):", val)
    await conn.close()

asyncio.run(main())
