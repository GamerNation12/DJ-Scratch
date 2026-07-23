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
                # Silently return None to let events.py pause the scanner without spamming console
                return None
            elif resp.status == 429:
                print(f"Spotify API 429 Rate Limited!")
                return None
            else:
                print(f"Spotify API error: {resp.status}")
                return None
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
                # Silently return None to let events.py pause the scanner without spamming console
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

async def fetch_user_currently_playing(user_id: str):
    """
    Fetches the exact progress_ms and duration_ms from Spotify for an authenticated user.
    Handles token refreshing automatically.
    Returns: (progress_sec, duration_sec) (float seconds) or (0.0, 0.0) if not playing or not linked.
    """
    from src.core.database import db_pool
    if not db_pool:
        return (0.0, 0.0)
        
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow('''
            SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at 
            FROM user_settings 
            WHERE user_id = $1
        ''', str(user_id))
        
        if not row or not row['spotify_access_token']:
            return (0.0, 0.0)
            
        access_token = row['spotify_access_token']
        refresh_token = row['spotify_refresh_token']
        expires_at = row['spotify_token_expires_at']
        
        # Check if token is expired (or expires in the next 10 seconds)
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        # Convert naive expires_at to UTC aware for comparison
        if expires_at:
            expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
        
        if expires_at and now >= expires_at - datetime.timedelta(seconds=10):
            # Token is expired, we must refresh it!
            import os
            client_id = os.getenv('SPOTIFY_CLIENT_ID')
            client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
            if not client_id or not client_secret:
                return (0.0, 0.0)
                
            import aiohttp
            import base64
            auth_str = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
            
            async with aiohttp.ClientSession() as session:
                async with session.post('https://accounts.spotify.com/api/token', headers={
                    'Authorization': f'Basic {auth_str}',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }, data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token
                }) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        access_token = data['access_token']
                        new_refresh = data.get('refresh_token', refresh_token)
                        new_expires = now + datetime.timedelta(seconds=data['expires_in'])
                        
                        await conn.execute('''
                            UPDATE user_settings 
                            SET spotify_access_token = $1, 
                                spotify_refresh_token = $2, 
                                spotify_token_expires_at = $3 
                            WHERE user_id = $4
                        ''', access_token, new_refresh, new_expires.replace(tzinfo=None), str(user_id))
                    else:
                        # Refresh failed, user needs to login again
                        return (0.0, 0.0)
                        
        # Now fetch the currently playing track!
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get('https://api.spotify.com/v1/me/player/currently-playing', headers={
                'Authorization': f'Bearer {access_token}'
            }) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data and data.get('is_playing') and 'progress_ms' in data:
                        progress = data['progress_ms'] / 1000.0
                        duration = 0.0
                        if 'item' in data and data['item'] and 'duration_ms' in data['item']:
                            duration = data['item']['duration_ms'] / 1000.0
                        return (progress, duration)
                        
    return (0.0, 0.0)
