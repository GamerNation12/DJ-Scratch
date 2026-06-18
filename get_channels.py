import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv('.env')
token = os.environ.get('DISCORD_TOKEN')

req = urllib.request.Request('https://discord.com/api/v10/users/@me/guilds')
req.add_header('Authorization', f'Bot {token}')
req.add_header('User-Agent', 'DiscordBot (https://github.com/GamerNation12, 1.0)')

with urllib.request.urlopen(req) as response:
    guilds = json.loads(response.read())

for g in guilds:
    print(g['name'], g['id'])
    
    req2 = urllib.request.Request(f'https://discord.com/api/v10/guilds/{g["id"]}/channels')
    req2.add_header('Authorization', f'Bot {token}')
    req2.add_header('User-Agent', 'DiscordBot (https://github.com/GamerNation12, 1.0)')
    
    with urllib.request.urlopen(req2) as response2:
        channels = json.loads(response2.read())
        
    for c in channels:
        if c.get('name') in ['website-log', 'errors', 'log']:
            print('  ', c['name'], c['id'])
