import aiohttp
import asyncio
import logging
import time
import urllib.parse
from datetime import datetime
from typing import Optional, Dict, Any, List

logger = logging.getLogger("statsfm")

# --- stats.fm public REST API ---
# Base URL from statsfm.js DefaultOptions: https://api.stats.fm/api
# Version: v1
# Routes from statsfm.js UsersManager:
#   GET /users/{userId} - profile
#   GET /users/{userId}/top/tracks - top tracks
#   GET /users/{userId}/top/artists - top artists
#   GET /users/{userId}/top/albums - top albums
#   GET /users/{userId}/streams/recent - recent plays
#
# NOTE: stats.fm does NOT issue API keys for public data, but the endpoints are
# subject to undocumented rate limits and schema changes.
STATSFM_BASE = "https://api.stats.fm/api/v1"

# Tiny in-memory TTL cache for stats.fm GETs
_API_CACHE: dict = {}  # url -> (data, expires_monotonic)


def _cache_get(url):
    entry = _API_CACHE.get(url)
    if entry and entry[1] > time.monotonic():
        return entry[0]
    if entry:
        _API_CACHE.pop(url, None)
    return None


def _cache_set(url, data, ttl=300):
    _API_CACHE[url] = (data, time.monotonic() + ttl)
    if len(_API_CACHE) > 300:
        for k in list(_API_CACHE.keys())[:60]:
            _API_CACHE.pop(k, None)


async def statsfm_get(path: str, params: Optional[Dict] = None, timeout_s: int = 10) -> Optional[Dict[str, Any]]:
    """Fetch from stats.fm public REST endpoint."""
    url = f"{STATSFM_BASE}/{path.lstrip('/')}"
    cached = _cache_get(url)
    if cached is not None:
        return cached

    try:
        headers = {
            "User-Agent": "@statsfm/statsfm.js (1.0.0) Node.js/v1"
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout_s)) as r:
                if r.status != 200:
                    logger.error(f"stats.fm API Error (status {r.status}) for {url}")
                    return None
                try:
                    data = await r.json()
                except Exception:
                    logger.error(f"Failed to parse JSON from stats.fm API: {url}")
                    return None

                _cache_set(url, data, ttl=300)
                return data
    except Exception as e:
        logger.error(f"stats.fm API request failed: {e}")
        return None


def _extract_track(item: Dict) -> Optional[Dict]:
    """Extract track info from stats.fm top/tracks item."""
    track = item.get("track")
    if not track:
        return None
    artists = track.get("artists", [])
    artist_name = artists[0].get("name") if artists else track.get("artistName") or "Unknown"
    return {
        "name": track.get("name") or "Unknown",
        "artist": artist_name,
        "playcount": item.get("streams") or 0,
        "image": track.get("image") or None,
        "duration_ms": track.get("durationMs") or 0,
    }


def _extract_artist(item: Dict) -> Optional[Dict]:
    """Extract artist info from stats.fm top/artists item."""
    artist = item.get("artist")
    if not artist:
        return None
    return {
        "name": artist.get("name") or "Unknown",
        "playcount": item.get("streams") or 0,
        "image": artist.get("image") or None,
        "followers": artist.get("followers") or 0,
    }


async def statsfm_user_top_tracks(username: str, limit: int = 10) -> Optional[List[Dict]]:
    """Get a user's top tracks from stats.fm."""
    data = await statsfm_get(f"users/{username}/top/tracks", {"limit": limit})
    if not data:
        return None
    items = data.get("items") or []
    tracks = []
    for item in items:
        t = _extract_track(item)
        if t:
            tracks.append(t)
    return tracks[:limit]


async def statsfm_user_top_artists(username: str, limit: int = 10) -> Optional[List[Dict]]:
    """Get a user's top artists from stats.fm."""
    data = await statsfm_get(f"users/{username}/top/artists", {"limit": limit})
    if not data:
        return None
    items = data.get("items") or []
    artists = []
    for item in items:
        a = _extract_artist(item)
        if a:
            artists.append(a)
    return artists[:limit]


async def statsfm_user_recent(username: str, limit: int = 10) -> Optional[List[Dict]]:
    """Get a user's recent scrobbles from stats.fm."""
    data = await statsfm_get(f"users/{username}/streams/recent", {"limit": limit})
    if not data:
        return None
    items = data.get("items") or data.get("streams") or []
    tracks = []
    for item in items:
        track = item.get("track")
        if not track:
            continue
        artists = track.get("artists", [])
        artist_name = artists[0].get("name") if artists else track.get("artistName") or "Unknown"
        tracks.append({
            "name": track.get("name") or "Unknown",
            "artist": artist_name,
            "played_at": item.get("playedAt") or None,
            "image": track.get("image") or None,
        })
    return tracks[:limit]


async def statsfm_user_profile(username: str) -> Optional[Dict]:
    """Get a user's profile from stats.fm."""
    data = await statsfm_get(f"users/{username}")
    if not data:
        return None
    item = data.get("item", {})
    return {
        "username": item.get("customId") or item.get("displayName") or username,
        "display_name": item.get("displayName") or "",
        "image": item.get("image") or None,
        "is_pro": item.get("isPro") or False,
    }


async def test_statsfm(username: str):
    """Test stats.fm connectivity with a real username. Returns (success, message, data)."""
    try:
        data = await statsfm_get(f"users/{username}")
        if data:
            return True, f"stats.fm reachable for user '{username}'", data
        return False, f"stats.fm returned empty/invalid for user '{username}'", None
    except Exception as e:
        return False, f"stats.fm test failed: {e}", None
