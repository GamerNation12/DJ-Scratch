from src.core.config import Log
import aiohttp
import asyncio
import os
import base64
import re
import time

# Matches open.spotify.com/<kind>/<id> and spotify:<kind>:<id> links.
_SPOTIFY_URL_RE = re.compile(
    r"(?:open\.spotify\.com/(track|album|artist|playlist)/([A-Za-z0-9]+)"
    r"|spotify:(track|album|artist|playlist):([A-Za-z0-9]+))"
)


def parse_spotify_url(text):
    """Extract (kind, spotify_id) from a Spotify link/URI, or None.

    >>> parse_spotify_url("https://open.spotify.com/track/4uLU6hMCjMIgFfFxN58xCc?si=x")
    ('track', '4uLU6hMCjMIgFfFxN58xCc')
    """
    if not text:
        return None
    m = _SPOTIFY_URL_RE.search(text)
    if not m:
        return None
    kind = m.group(1) or m.group(3)
    sid = m.group(2) or m.group(4)
    return (kind, sid)


def _norm_track(track):
    return {
        "uri": track.get("uri"),
        "id": track.get("id"),
        "name": track.get("name"),
        "artists": [a.get("name") for a in track.get("artists", [])],
        "spotify_url": track.get("external_urls", {}).get("spotify"),
        "album_name": track.get("album", {}).get("name"),
        "album_images": track.get("album", {}).get("images", []),
    }


def _norm_album(album):
    artists = [a.get("name") for a in album.get("artists", [])]
    return {
        "uri": album.get("uri"),
        "id": album.get("id"),
        "name": album.get("name"),
        "artists": artists,
        "spotify_url": album.get("external_urls", {}).get("spotify"),
        "album_name": album.get("name"),
        "album_images": album.get("images", []),
    }


def _norm_artist_full(artist):
    return {
        "uri": "spotify:artist:{}".format(artist.get("id")) if artist.get("id") else None,
        "id": artist.get("id"),
        "name": artist.get("name"),
        "artists": [artist.get("name")] if artist.get("name") else [],
        "spotify_url": artist.get("external_urls", {}).get("spotify"),
        "album_name": "",
        "album_images": artist.get("images", []),
    }

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

_access_token = None
_token_expiry = 0

async def get_spotify_token(session: aiohttp.ClientSession):
    global _access_token, _token_expiry
    
    if _access_token and time.time() < _token_expiry:
        return _access_token
        
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
        
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth_str}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    
    try:
        async with session.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=3.0) as resp:
            if resp.status == 200:
                resp_data = await resp.json()
                _access_token = resp_data.get("access_token")
                _token_expiry = time.time() + resp_data.get("expires_in", 3600) - 60
                return _access_token
    except Exception as e:
        print(f"{Log.RED}>>> Failed to get Spotify token: {type(e).__name__}: {e}{Log.RESET}")
        
    return None

_TRACK_CACHE: dict = {}  # (artist, song) -> (info, expires)
_TRACK_TTL = 86400.0


async def get_spotify_track_info(session: aiohttp.ClientSession, artist: str, song: str, user_token: str = None):
    """
    Returns a dictionary with:
    - spotify_url: Link to the track on Spotify
    - preview_url: 30s audio preview
    - image_url: High-res album art (640x640)
    """
    # Cache anonymous lookups (user-token lookups vary per user, don't cache those).
    cache_key = None
    if not user_token and artist and song:
        cache_key = (artist.lower(), song.lower())
        entry = _TRACK_CACHE.get(cache_key)
        if entry and entry[1] > time.time():
            return entry[0]
    token = user_token or await get_spotify_token(session)
    if not token:
        return None
        
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    query = f"track:{song} artist:{artist}"
    params = {
        "q": query,
        "type": "track",
        "limit": 1
    }
    
    try:
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                tracks = data.get("tracks", {}).get("items", [])
                if tracks:
                    track = tracks[0]
                    info = {
                        "name": track.get("name"),
                        "spotify_url": track.get("external_urls", {}).get("spotify"),
                        "preview_url": track.get("preview_url"),
                        "image_url": track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                        "artists": [a.get("name") for a in track.get("artists", [])]
                    }
                    if cache_key:
                        _TRACK_CACHE[cache_key] = (info, time.time() + _TRACK_TTL)
                        if len(_TRACK_CACHE) > 2000:
                            _TRACK_CACHE.pop(next(iter(_TRACK_CACHE)))
                    return info
    except Exception as e:
        print(f"{Log.RED}>>> Failed to fetch Spotify track: {type(e).__name__}: {e}{Log.RESET}")

    return None

from src.core.database import get_user_spotify_refresh_token

from src.core.database import format_name


async def get_user_spotify_access_token(session: aiohttp.ClientSession, user_id: str):
    refresh_token = await get_user_spotify_refresh_token(user_id)
    if not refresh_token:
        return None
        
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
        
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth_str}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }
    
    try:
        async with session.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=3.0) as resp:
            if resp.status == 200:
                resp_data = await resp.json()
                return resp_data.get("access_token")
    except Exception as e:
        print(f"{Log.RED}>>> Failed to refresh Spotify user token: {type(e).__name__}: {e}{Log.RESET}")
        
    return None

async def spotify_play_track(session: aiohttp.ClientSession, user_id: str, track_uri: str = None, context_uri: str = None):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"

    headers = {"Authorization": f"Bearer {token}"}
    if context_uri:
        data = {"context_uri": context_uri}  # album / artist / playlist playback
    elif track_uri:
        data = {"uris": [track_uri]}
    else:
        data = {}
    
    async with session.put("https://api.spotify.com/v1/me/player/play", headers=headers, json=data) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_pause_playback(session: aiohttp.ClientSession, user_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.put("https://api.spotify.com/v1/me/player/pause", headers=headers) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_skip_to_next(session: aiohttp.ClientSession, user_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.post("https://api.spotify.com/v1/me/player/next", headers=headers, timeout=3.0) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_skip_to_previous(session: aiohttp.ClientSession, user_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.post("https://api.spotify.com/v1/me/player/previous", headers=headers, timeout=3.0) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_add_to_queue(session: aiohttp.ClientSession, user_id: str, track_uri: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.post(f"https://api.spotify.com/v1/me/player/queue?uri={track_uri}", headers=headers, timeout=3.0) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_like_track(session: aiohttp.ClientSession, user_id: str, track_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with session.put(f"https://api.spotify.com/v1/me/tracks?ids={track_id}", headers=headers) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_unlike_track(session: aiohttp.ClientSession, user_id: str, track_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with session.delete(f"https://api.spotify.com/v1/me/tracks?ids={track_id}", headers=headers) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def search_spotify_track(session: aiohttp.ClientSession, query: str):
    token = await get_spotify_token(session)
    if not token: return None
    
    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": query, "type": "track", "limit": 1}
    try:
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                tracks = data.get("tracks", {}).get("items", [])
                if tracks:
                    track = tracks[0]
                    return {
                        "uri": track.get("uri"),
                        "id": track.get("id"),
                        "name": track.get("name"),
                        "artists": [a.get("name") for a in track.get("artists", [])],
                        "spotify_url": track.get("external_urls", {}).get("spotify"),
                        "album_name": track.get("album", {}).get("name"),
                        "album_images": track.get("album", {}).get("images", [])
                    }
    except Exception as e:
        print(f"{Log.RED}>>> Failed to search Spotify track: {type(e).__name__}: {e}{Log.RESET}")
    return None

async def search_spotify_artist(session: aiohttp.ClientSession, artist_name: str):
    token = await get_spotify_token(session)
    if not token: return None
    
    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": artist_name, "type": "artist", "limit": 1}
    try:
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                artists = data.get("artists", {}).get("items", [])
                if artists:
                    artist = artists[0]
                    return {
                        "popularity": artist.get("popularity"),
                        "genres": artist.get("genres", [])
                    }
    except Exception as e:
        print(f"{Log.RED}>>> Failed to search Spotify artist: {type(e).__name__}: {e}{Log.RESET}")
    return None

async def _search_one(session: aiohttp.ClientSession, query: str, kind: str):
    """Search Spotify for one album or artist. Returns the raw API object or None."""
    token = await get_spotify_token(session)
    if not token:
        return None
    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": query, "type": kind, "limit": 1}
    try:
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                items = data.get(f"{kind}s", {}).get("items", [])
                if items:
                    return items[0]
    except Exception as e:
        print(f"{Log.RED}>>> Failed to search Spotify {kind}: {type(e).__name__}: {e}{Log.RESET}")
    return None


async def search_spotify_album(session: aiohttp.ClientSession, query: str):
    """Search for an album. Returns normalized info dict or None."""
    album = await _search_one(session, query, "album")
    return _norm_album(album) if album else None


async def search_spotify_artist_full(session: aiohttp.ClientSession, query: str):
    """Search for an artist. Returns normalized info dict or None."""
    artist = await _search_one(session, query, "artist")
    return _norm_artist_full(artist) if artist else None


async def fetch_spotify_by_id(session: aiohttp.ClientSession, kind: str, spotify_id: str):
    """Fetch a track/album/artist straight by ID (for pasted Spotify links)."""
    if kind not in ("track", "album", "artist"):
        return None
    token = await get_spotify_token(session)
    if not token:
        return None
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with session.get(f"https://api.spotify.com/v1/{kind}s/{spotify_id}", headers=headers, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                if kind == "track":
                    return _norm_track(data)
                if kind == "album":
                    return _norm_album(data)
                return _norm_artist_full(data)
    except Exception as e:
        print(f"{Log.RED}>>> Failed to fetch Spotify {kind} {spotify_id}: {type(e).__name__}: {e}{Log.RESET}")
    return None

async def get_currently_playing_track(session: aiohttp.ClientSession, user_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with session.get("https://api.spotify.com/v1/me/player/currently-playing", headers=headers, timeout=3.0) as resp:
            if resp.status == 200:
                data = await resp.json()
                if not data or not data.get('item'):
                    return None
                track = data['item']
                return {
                    "uri": track.get("uri"),
                    "id": track.get("id"),
                    "name": track.get("name"),
                    "artists": [a.get("name") for a in track.get("artists", [])],
                    "spotify_url": track.get("external_urls", {}).get("spotify"),
                    "album_name": track.get("album", {}).get("name"),
                    "album_images": track.get("album", {}).get("images", [])
                }
            elif resp.status == 204:
                return None
    except Exception as e:
        pass
    return None
