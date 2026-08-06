import re

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/cogs/admin.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix cleanduplicates
old_clean = """
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("DELETE FROM listens WHERE album_name = '' OR album_name IS NULL")
                
                result = await conn.execute(\"\"\"
                    DELETE FROM listens a USING listens b
                    WHERE a.user_id = b.user_id 
                      AND a.artist_name = b.artist_name 
                      AND a.track_name = b.track_name 
                      AND a.ctid > b.ctid 
                      AND a.played_at >= b.played_at - interval '2 minutes' 
                      AND a.played_at <= b.played_at + interval '2 minutes'
                \"\"\")
"""
new_clean = """
            async with self.bot.db_pool.acquire() as conn:
                result = await conn.execute(\"\"\"
                    DELETE FROM listens a USING listens b
                    WHERE a.user_id = b.user_id 
                      AND a.track_id = b.track_id
                      AND a.ctid > b.ctid 
                      AND a.played_at >= b.played_at - interval '2 minutes' 
                      AND a.played_at <= b.played_at + interval '2 minutes'
                \"\"\")
"""
code = code.replace(old_clean.strip(), new_clean.strip())

# Fix wipe data
code = code.replace('await conn.execute("TRUNCATE TABLE listens;")', 'await conn.execute("TRUNCATE TABLE listens, tracks CASCADE;")')

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/cogs/admin.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated admin.py')
