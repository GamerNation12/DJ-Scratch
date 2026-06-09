import aiohttp
import urllib.parse
from ..core.config import LASTFM_API_KEY, LASTFM_API_SECRET

async def api_get(url):
    from ..core.events import bot
    async with bot.session.get(url) as r:
        return await r.json() if r.status == 200 else None
async def fetch_now_playing(u, l=1): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}")
async def fetch_top_artists(u, p='overall', l=10): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}&period={p}")
async def fetch_top_tracks(u, p='overall', l=10): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}&period={p}")
async def fetch_top_albums(u, p='overall', l=10): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}&period={p}")
async def fetch_user_profile(u): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_track_info(u, artist, track): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=track.getinfo&artist={urllib.parse.quote(artist)}&track={urllib.parse.quote(track)}&username={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_artist_info(u, artist): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={urllib.parse.quote(artist)}&username={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_artist_playcount(session, u, artist):
    async with session.get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={urllib.parse.quote(artist)}&username={u}&api_key={LASTFM_API_KEY}&format=json") as r:
        if r.status == 200:
            d = await r.json()
            return int(d['artist']['stats']['userplaycount']) if 'artist' in d else 0
    return 0

async def fetch_artist_top_tracks_global(artist, limit=50):
    data = await api_get(f"http://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist={urllib.parse.quote(artist)}&api_key={LASTFM_API_KEY}&format=json&limit={limit}")
    if data and 'toptracks' in data:
        return [t['name'] for t in data['toptracks']['track']]
    return []

async def fetch_user_artist_tracks_lastfm(u, artist):
    # Fetch global top 40 tracks for the artist
    top_tracks = await fetch_artist_top_tracks_global(artist, 40)
    if not top_tracks: return []
    
    import asyncio
    # Concurrently fetch track info for these tracks
    tasks = [fetch_track_info(u, artist, t) for t in top_tracks]
    results = await asyncio.gather(*tasks)
    
    user_tracks = []
    for res in results:
        if res and 'track' in res:
            t_info = res['track']
            pc = int(t_info.get('userplaycount', 0))
            if pc > 0:
                user_tracks.append((t_info['name'], pc))
                
    # Sort by user playcount descending
    user_tracks.sort(key=lambda x: x[1], reverse=True)
    return user_tracks