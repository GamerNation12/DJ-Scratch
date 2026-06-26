from src.core.config import Log
import aiohttp
import urllib.parse

from src.core.database import format_name
import logging
log = logging.getLogger("discord.bot")


async def fetch_lyrics(session: aiohttp.ClientSession, artist: str, song: str):
    """
    Fetches lyrics using the free lrclib.net service.
    Returns the lyrics string if found, else None.
    """
    url = "https://lrclib.net/api/get"
    params = {
        "artist_name": artist,
        "track_name": song
    }
    
    try:
        async with session.get(url, params=params) as resp:
            if resp.status == 200:
                data = await resp.json()
                lyrics = data.get("syncedLyrics") or data.get("plainLyrics")
                return lyrics
    except Exception as e:
        log.info(f"{Log.RED}Failed to fetch lyrics: {e}{Log.RESET}")
        
    return None
