import re

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix Line 701
code = code.replace(
    'SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id l WHERE l.user_id=$1',
    'SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1'
)

# Fix Line 704
code = code.replace(
    'SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id l WHERE l.user_id=$1 AND played_at < $2',
    'SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 AND l.played_at < $2'
)

# Fix Line 708
code = code.replace(
    'SELECT track_name, artist_name, played_at FROM listens l JOIN tracks t ON l.track_id = t.id WHERE user_id=$1 ORDER BY played_at DESC LIMIT $2',
    'SELECT t.track_name, t.artist_name, l.played_at FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 ORDER BY l.played_at DESC LIMIT $2'
)

# Fix Line 915
code = code.replace(
    'SELECT artist_name, track_name, album_name FROM listens l JOIN tracks t ON l.track_id = t.id WHERE user_id=$1 ORDER BY listened_at DESC',
    'SELECT t.artist_name, t.track_name, t.album_name FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 ORDER BY l.played_at DESC'
)

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Fixed remaining syntax errors in database.py')
