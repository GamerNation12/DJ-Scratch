import aiohttp
import asyncio
import os
import base64
import time

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
        async with session.post("https://accounts.spotify.com/api/token", headers=headers, data=data) as resp:
            if resp.status == 200:
                resp_data = await resp.json()
                _access_token = resp_data.get("access_token")
                _token_expiry = time.time() + resp_data.get("expires_in", 3600) - 60
                return _access_token
    except Exception as e:
        log.error(f"Failed to get Spotify token: {e}")
        
    return None

async def get_spotify_track_info(session: aiohttp.ClientSession, artist: str, song: str):
    """
    Returns a dictionary with:
    - spotify_url: Link to the track on Spotify
    - preview_url: 30s audio preview
    - image_url: High-res album art (640x640)
    """
    token = await get_spotify_token(session)
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
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params) as resp:
            if resp.status == 200:
                data = await resp.json()
                tracks = data.get("tracks", {}).get("items", [])
                if tracks:
                    track = tracks[0]
                    return {
                        "spotify_url": track.get("external_urls", {}).get("spotify"),
                        "preview_url": track.get("preview_url"),
                        "image_url": track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                        "artists": [a.get("name") for a in track.get("artists", [])]
                    }
    except Exception as e:
        log.error(f"Failed to fetch Spotify track: {e}")
        
    return None

from src.core.database import get_user_spotify_refresh_token

from src.core.database import format_name
import logging
log = logging.getLogger("goats")


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
        async with session.post("https://accounts.spotify.com/api/token", headers=headers, data=data) as resp:
            if resp.status == 200:
                resp_data = await resp.json()
                return resp_data.get("access_token")
    except Exception as e:
        log.error(f"Failed to refresh Spotify user token: {e}")
        
    return None

async def spotify_play_track(session: aiohttp.ClientSession, user_id: str, track_uri: str = None):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    data = {"uris": [track_uri]} if track_uri else {}
    
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
    async with session.post("https://api.spotify.com/v1/me/player/next", headers=headers) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_skip_to_previous(session: aiohttp.ClientSession, user_id: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.post("https://api.spotify.com/v1/me/player/previous", headers=headers) as resp:
        if resp.status in [200, 202, 204]: return True
        return await resp.text()

async def spotify_add_to_queue(session: aiohttp.ClientSession, user_id: str, track_uri: str):
    token = await get_user_spotify_access_token(session, user_id)
    if not token: return "no_token"
    
    headers = {"Authorization": f"Bearer {token}"}
    async with session.post(f"https://api.spotify.com/v1/me/player/queue?uri={track_uri}", headers=headers) as resp:
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
        async with session.get("https://api.spotify.com/v1/search", headers=headers, params=params) as resp:
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
                        "spotify_url": track.get("external_urls", {}).get("spotify")
                    }
    except Exception as e:
        log.error(f"Failed to search Spotify track: {e}")
    return None
