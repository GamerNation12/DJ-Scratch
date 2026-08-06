import re
import os

# 1. web/src/app/api/stats/route.ts
stats_path = 'c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/api/stats/route.ts'
with open(stats_path, 'r', encoding='utf-8') as f:
    stats_code = f.read()

stats_code = stats_code.replace(
    '''SELECT artist_name, COUNT(*) as playcount
      FROM listens
      GROUP BY artist_name''',
    '''SELECT t.artist_name, COUNT(*) as playcount
      FROM listens l JOIN tracks t ON l.track_id = t.id
      GROUP BY t.artist_name'''
)

with open(stats_path, 'w', encoding='utf-8') as f:
    f.write(stats_code)


# 2. web/src/app/api/u/[id]/route.ts
u_path = 'c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/api/u/[id]/route.ts'
with open(u_path, 'r', encoding='utf-8') as f:
    u_code = f.read()

u_code = u_code.replace(
    'SELECT artist_name, COUNT(*) as playcount FROM listens WHERE user_id = ${uId} GROUP BY artist_name',
    'SELECT t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} GROUP BY t.artist_name'
)
u_code = u_code.replace(
    'SELECT track_name, artist_name, COUNT(*) as playcount FROM listens WHERE user_id = ${uId} GROUP BY track_name, artist_name',
    'SELECT t.track_name, t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} GROUP BY t.track_name, t.artist_name'
)
u_code = u_code.replace(
    'SELECT track_name, artist_name, played_at FROM listens WHERE user_id = ${uId} ORDER BY played_at',
    'SELECT t.track_name, t.artist_name, l.played_at FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} ORDER BY l.played_at'
)

with open(u_path, 'w', encoding='utf-8') as f:
    f.write(u_code)


# 3. web/src/app/api/user-stats/route.ts
us_path = 'c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/api/user-stats/route.ts'
with open(us_path, 'r', encoding='utf-8') as f:
    us_code = f.read()

us_code = us_code.replace(
    '''SELECT artist_name, COUNT(*) as playcount
        FROM listens
        WHERE user_id = ${userId}
        GROUP BY artist_name''',
    '''SELECT t.artist_name, COUNT(*) as playcount
        FROM listens l JOIN tracks t ON l.track_id = t.id
        WHERE l.user_id = ${userId}
        GROUP BY t.artist_name'''
)

with open(us_path, 'w', encoding='utf-8') as f:
    f.write(us_code)

print("Updated web API routes!")
