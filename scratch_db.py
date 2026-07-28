import asyncio
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    print(f"Connecting to {db_url}")
    conn = await asyncpg.connect(db_url)
    
    print("--- recent website_logs ---")
    logs = await conn.fetch("SELECT * FROM website_logs ORDER BY timestamp DESC LIMIT 5")
    for row in logs:
        print(dict(row))
        
    print("--- recent user_settings ---")
    users = await conn.fetch("SELECT user_id, lastfm_username FROM user_settings ORDER BY user_id DESC LIMIT 5")
    for row in users:
        print(dict(row))

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
