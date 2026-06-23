import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv("web/.env.local")

async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return
    
    print(f"Connecting to DB...")
    conn = await asyncpg.connect(db_url)
    try:
        await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT;")
        print("Successfully added display_name column to user_settings.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
