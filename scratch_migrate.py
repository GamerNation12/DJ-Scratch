import asyncio
import sys
sys.path.append('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot')
from dotenv import load_dotenv
load_dotenv('c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env')

from src.core.database import init_db

async def migrate():
    await init_db()
    import src.core.database
    pool = src.core.database.db_pool
    
    async with pool.acquire() as conn:
        print("Starting migration transaction...")
        async with conn.transaction():
            print("1. Creating tracks table...")
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS tracks (
                    id SERIAL PRIMARY KEY,
                    artist_name VARCHAR(255) NOT NULL,
                    track_name VARCHAR(255) NOT NULL,
                    album_name VARCHAR(255) NOT NULL DEFAULT '',
                    UNIQUE(artist_name, track_name, album_name)
                );
            ''')
            
            print("2. Populating tracks table (this might take a few seconds)...")
            await conn.execute('''
                INSERT INTO tracks (artist_name, track_name, album_name)
                SELECT DISTINCT artist_name, track_name, COALESCE(album_name, '')
                FROM listens
                ON CONFLICT DO NOTHING;
            ''')
            
            print("3. Adding track_id column to listens...")
            await conn.execute('ALTER TABLE listens ADD COLUMN IF NOT EXISTS track_id INT REFERENCES tracks(id);')
            
            print("4. Updating track_id in listens (this might take 10-30 seconds)...")
            await conn.execute('''
                UPDATE listens l
                SET track_id = t.id
                FROM tracks t
                WHERE l.artist_name = t.artist_name 
                  AND l.track_name = t.track_name 
                  AND COALESCE(l.album_name, '') = t.album_name
                  AND l.track_id IS NULL;
            ''')
            
            print("5. Dropping old text columns from listens...")
            await conn.execute('''
                ALTER TABLE listens
                DROP COLUMN artist_name,
                DROP COLUMN track_name,
                DROP COLUMN album_name;
            ''')
            
            print("6. Creating index on track_id for faster queries...")
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_listens_track_id ON listens(track_id);')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_listens_user_id ON listens(user_id);')

        print("Migration complete! Transaction committed.")

asyncio.run(migrate())
