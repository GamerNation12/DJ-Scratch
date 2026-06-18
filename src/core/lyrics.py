import aiohttp
import urllib.parse

async def fetch_lyrics(session: aiohttp.ClientSession, artist: str, song: str):
    """
    Fetches lyrics using the free api.lyrics.ovh service.
    Returns the lyrics string if found, else None.
    """
    artist_enc = urllib.parse.quote(artist)
    song_enc = urllib.parse.quote(song)
    url = f"https://api.lyrics.ovh/v1/{artist_enc}/{song_enc}"
    
    try:
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("lyrics")
    except Exception as e:
        print(f"Failed to fetch lyrics: {e}")
        
    return None
