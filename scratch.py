import asyncio
import aiohttp
from src.utils.api import fetch_top_tracks, fetch_user_profile

async def main():
    username = "GamerNation13"
    user_info = await fetch_user_profile(username)
    print("User info:", user_info)
    
    lastfm_data = await fetch_top_tracks(username, 'overall', 10)
    for t in lastfm_data['toptracks']['track'][:5]:
        print(t['name'], t['artist']['name'], t['playcount'])

asyncio.run(main())
