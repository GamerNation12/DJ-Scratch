import aiohttp
import asyncio
import os
import base64
from datetime import datetime, timedelta

_spotify_access_token = None
_spotify_token_expires = None
_spotify_lock = asyncio.Lock()
_spotify_session = None

async def get_spotify_session():
    global _spotify_session
    if _spotify_session is None or _spotify_session.closed:
        _spotify_session = aiohttp.ClientSession()
    return _spotify_session

async def get_spotify_token():
    global _spotify_access_token, _spotify_token_expires
    
    async with _spotify_lock:
        if _spotify_access_token and _spotify_token_expires and datetime.now() < _spotify_token_expires:
            return _spotify_access_token
            
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            return None
            
        auth_string = f"{client_id}:{client_secret}"
        auth_bytes = auth_string.encode('utf-8')
        auth_base64 = str(base64.b64encode(auth_bytes), 'utf-8')
        
        url = "https://accounts.spotify.com/api/token"
        headers = {
            "Authorization": f"Basic {auth_base64}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}
        
        try:
            session = await get_spotify_session()
            async with session.post(url, headers=headers, data=data) as resp:
                if resp.status == 200:
                    json_data = await resp.json()
                    _spotify_access_token = json_data['access_token']
                    expires_in = json_data['expires_in']
                    _spotify_token_expires = datetime.now() + timedelta(seconds=expires_in - 60)
                    return _spotify_access_token
        except Exception as e:
            print(f"Error fetching Spotify token: {e}")
            
        return None

async def fetch_spotify_track_durations(uris: list):
    """Fetches durations for a list of Spotify track URIs (max 50). Returns dict of {uri: duration_ms}"""
    if not uris: return {}
    
    token = await get_spotify_token()
    if not token: return {}
    
    # Extract IDs from URIs (spotify:track:ID)
    ids = []
    uri_to_id = {}
    for uri in uris:
        if uri and "spotify:track:" in uri:
            track_id = uri.split(":")[-1]
            ids.append(track_id)
            uri_to_id[track_id] = uri
            
    if not ids: return {}
    
    # Spotify allows max 50 IDs per request
    ids = ids[:50]
    id_string = ",".join(ids)
    
    url = f"https://api.spotify.com/v1/tracks?ids={id_string}"
    headers = {"Authorization": f"Bearer {token}"}
    
    durations = {}
    try:
        session = await get_spotify_session()
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                for track in data.get('tracks', []):
                    if track and 'id' in track and 'duration_ms' in track:
                        uri = uri_to_id.get(track['id'])
                        if uri:
                            durations[uri] = track['duration_ms']
            elif resp.status == 403:
                print(f"Spotify API 403 Forbidden! Missing Premium subscription.")
                return None
            elif resp.status == 429:
                print(f"Spotify API 429 Rate Limited!")
                return None
            else:
                print(f"Spotify API error: {resp.status}")
                return None
    except Exception as e:
        print(f"Error fetching Spotify tracks: {e}")
        return None
        
    return durations
