import re

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix Line 460, 468, 476
code = code.replace('WHERE user_id=$1 AND LOWER(artist_name)', 'WHERE l.user_id=$1 AND LOWER(t.artist_name)')
code = code.replace('AND LOWER(track_name)', 'AND LOWER(t.track_name)')
code = code.replace('AND LOWER(album_name)', 'AND LOWER(t.album_name)')

# Fix Lines 671, 682, 693
code = code.replace('WHERE LOWER(artist_name)', 'WHERE LOWER(t.artist_name)')

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/database.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated missed queries')
