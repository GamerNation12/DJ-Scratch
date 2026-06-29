import aiohttp
import urllib.parse
import logging
from ..core.config import LASTFM_API_KEY, LASTFM_API_SECRET

from src.core.database import format_name


async def api_get(url):
    from ..core.events import bot
    import aiohttp
    try:
        async with bot.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            try:
                data = await r.json()
            except Exception:
                data = None
                logging.error(f"Failed to parse JSON from Last.fm API. Status: {r.status}")

            if r.status != 200 or (isinstance(data, dict) and 'error' in data):
                logging.error(f"Last.fm API Error: {data} for url: {url.replace(LASTFM_API_KEY, 'HIDDEN_KEY')}")
            
            return data
    except Exception as e:
        logging.error(f"API get failed: {e}")
        return None
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
            if 'artist' in d and 'stats' in d['artist']:
                return int(d['artist']['stats'].get('userplaycount', 0))
            return 0
    return 0

async def fetch_artist_top_tracks_global(artist, limit=50):
    data = await api_get(f"http://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist={urllib.parse.quote(artist)}&api_key={LASTFM_API_KEY}&format=json&limit={limit}")
    if data and 'toptracks' in data:
        return [t['name'] for t in data['toptracks']['track']]
    return []

async def fetch_user_artist_tracks_lastfm(u, artist):
    # Fetch global top 100 tracks for the artist
    top_tracks = await fetch_artist_top_tracks_global(artist, 100)
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

async def fetch_deezer_artist_image(session, artist_name):
    url = f"https://api.deezer.com/search/artist?q={urllib.parse.quote(artist_name)}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            if r.status == 200:
                data = await r.json()
                if data and 'data' in data and len(data['data']) > 0:
                    artist = data['data'][0]
                    return artist.get('picture_xl') or artist.get('picture_big') or artist.get('picture')
    except Exception as e:
        logging.error(f"Deezer fetch error: {e}")
    return None

async def fetch_deezer_track_image(session, track_name, artist_name):
    url = f"https://api.deezer.com/search/track?q={urllib.parse.quote(track_name + ' ' + artist_name)}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            if r.status == 200:
                data = await r.json()
                if data and 'data' in data and len(data['data']) > 0:
                    track = data['data'][0]
                    album = track.get('album', {})
                    return album.get('cover_xl') or album.get('cover_big') or album.get('cover')
    except Exception as e:
        logging.error(f"Deezer track fetch error: {e}")
    return None

async def scrobble_bot_track(artist, track):
    import os
    BOT_LASTFM_SESSION_KEY = os.getenv("BOT_LASTFM_SESSION_KEY")
    if not BOT_LASTFM_SESSION_KEY or not LASTFM_API_SECRET:
        return False
        
    import hashlib
    import time
    timestamp = str(int(time.time()))
    params = {
        'api_key': LASTFM_API_KEY,
        'artist': artist,
        'method': 'track.scrobble',
        'sk': BOT_LASTFM_SESSION_KEY,
        'timestamp': timestamp,
        'track': track
    }
    
    sig_string = ""
    for k in sorted(params.keys()):
        sig_string += f"{k}{params[k]}"
    sig_string += LASTFM_API_SECRET
    
    api_sig = hashlib.md5(sig_string.encode('utf-8')).hexdigest()
    params['api_sig'] = api_sig
    params['format'] = 'json'

    from ..core.events import bot
    import aiohttp
    try:
        async with bot.session.post("http://ws.audioscrobbler.com/2.0/", data=params) as r:
            if r.status == 200:
                data = await r.json()
                if 'scrobbles' in data:
                    logging.info(f"Successfully scrobbled {track} by {artist} to bot profile.")
                    return True
            else:
                logging.error(f"Bot scrobble failed with status {r.status}: {await r.text()}")
    except Exception as e:
        logging.error(f"Bot scrobble request failed: {e}")
    return False
