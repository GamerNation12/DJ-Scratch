import re

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace column names in query_parts
code = code.replace('"user_id=$1"', '"l.user_id=$1"')
code = code.replace('"played_at >=', '"l.played_at >=')
code = code.replace('"played_at <', '"l.played_at <')
code = code.replace('EXTRACT(YEAR FROM played_at', 'EXTRACT(YEAR FROM l.played_at')

code = code.replace('"album_name IS NOT NULL"', '"t.album_name IS NOT NULL AND t.album_name != \'\'"')
code = code.replace('"LOWER(artist_name)=LOWER($2)"', '"LOWER(t.artist_name)=LOWER($2)"')

# Now replace the query strings
code = code.replace('SELECT artist_name, COUNT(*) as plays FROM listens WHERE', 'SELECT t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE')
code = code.replace('GROUP BY artist_name', 'GROUP BY t.artist_name')

code = code.replace('SELECT album_name, artist_name, COUNT(*) as plays FROM listens WHERE', 'SELECT t.album_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE')
code = code.replace('GROUP BY album_name, artist_name', 'GROUP BY t.album_name, t.artist_name')

code = code.replace('SELECT track_name, artist_name, COUNT(*) as plays FROM listens WHERE', 'SELECT t.track_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE')
code = code.replace('GROUP BY track_name, artist_name', 'GROUP BY t.track_name, t.artist_name')

code = code.replace('SELECT track_name, COUNT(*) as plays FROM listens WHERE', 'SELECT t.track_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE')
code = code.replace('GROUP BY track_name ORDER BY', 'GROUP BY t.track_name ORDER BY')

code = code.replace('SELECT COUNT(*) as total FROM listens WHERE user_id=$1', 'SELECT COUNT(*) as total FROM listens l WHERE l.user_id=$1')
code = code.replace('SELECT COUNT(*) as total FROM listens WHERE user_id=$1 AND played_at < $2', 'SELECT COUNT(*) as total FROM listens l WHERE l.user_id=$1 AND l.played_at < $2')

# Server stats query
code = code.replace('SELECT COUNT(*) FROM listens WHERE user_id = ANY($1::varchar[])', 'SELECT COUNT(*) FROM listens l WHERE l.user_id = ANY($1::varchar[])')
code = code.replace('FROM listens', 'FROM listens l JOIN tracks t ON l.track_id = t.id')

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated database queries')
