import asyncio
from src.core.database import init_db, db_pool
async def main():
    await init_db()
    async with db_pool.acquire() as conn:
        try:
            await conn.execute('ALTER TABLE user_settings ADD COLUMN embed_color TEXT;')
            print('Added embed_color column')
        except Exception as e:
            print(e)
asyncio.run(main())
