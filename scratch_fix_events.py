import re

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/events.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the chunk insertion block
old_block = """
        try:
            async with db_pool.acquire() as conn:
                await conn.executemany(
                    \"\"\"
                    INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at, ms_played, spotify_uri)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
                    \"\"\",
                    chunk
                )
                inserted_count += len(chunk)
                print(f"    [IMPORT PROGRESS] Inserted chunk... ({inserted_count} valid non-overlapping tracks so far)")
        except Exception as e:
            print(f"{Log.RED}>>> Error inserting database chunk: {e}{Log.RESET}")
"""

new_block = """
        try:
            async with db_pool.acquire() as conn:
                async with conn.transaction():
                    unique_tracks = list({(c[1], c[2], c[3] or '') for c in chunk})
                    await conn.executemany(
                        \"\"\"
                        INSERT INTO tracks (artist_name, track_name, album_name)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (artist_name, track_name, album_name) DO NOTHING
                        \"\"\",
                        unique_tracks
                    )
                    
                    await conn.executemany(
                        \"\"\"
                        INSERT INTO listens (user_id, track_id, played_at, ms_played, spotify_uri)
                        SELECT $1, t.id, $5, $6, $7
                        FROM tracks t
                        WHERE t.artist_name = $2 AND t.track_name = $3 AND t.album_name = COALESCE($4, '')
                        ON CONFLICT (user_id, track_id, played_at) DO NOTHING
                        \"\"\",
                        chunk
                    )
                inserted_count += len(chunk)
                print(f"    [IMPORT PROGRESS] Inserted chunk... ({inserted_count} valid non-overlapping tracks so far)")
        except Exception as e:
            print(f"{Log.RED}>>> Error inserting database chunk: {e}{Log.RESET}")
"""

code = code.replace(old_block.strip(), new_block.strip())

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/events.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated events.py import logic')
