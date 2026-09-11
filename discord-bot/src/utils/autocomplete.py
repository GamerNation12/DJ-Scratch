"""Shared slash-command autocomplete backed by Last.fm search.

Fast by design for Discord's 3s autocomplete window: short timeouts, no
retries, aggressive in-memory + API caching. Returns at most 25 Choices
with name/value truncated to Discord's 100-char limits.
"""
import time
import urllib.parse

_CACHE: dict = {}  # (kind, query) -> (results, expires_monotonic)
_TTL = 600.0


async def _search(kind: str, query: str):
    """Raw normalized search results: [{name, artist?, listeners?}]."""
    from src.utils.api import api_get
    from src.core.config import LASTFM_API_KEY

    query = (query or "").strip()[:80]
    if len(query) < 2:
        return []
    key = (kind, query.lower())
    e = _CACHE.get(key)
    if e and e[1] > time.monotonic():
        return e[0]

    param = "artist" if kind == "artist" else kind
    url = (
        f"https://ws.audioscrobbler.com/2.0/?method={kind}.search"
        f"&{param}={urllib.parse.quote(query)}"
        f"&api_key={LASTFM_API_KEY}&format=json&limit=8"
    )
    try:
        data = await api_get(url, max_retries=1, timeout_s=2, cache_ttl=600)
    except Exception:
        return []

    try:
        if kind == "artist":
            raw = (data.get("results", {}).get("artistmatches", {}).get("artist") or [])
        elif kind == "track":
            raw = (data.get("results", {}).get("trackmatches", {}).get("track") or [])
        else:
            raw = (data.get("results", {}).get("albummatches", {}).get("album") or [])
        if isinstance(raw, dict):
            raw = [raw]
        out = []
        for x in raw[:8]:
            name = (x.get("name") or "").strip()
            if not name:
                continue
            a = x.get("artist", "")
            artist = (a.strip() if isinstance(a, str) else (a.get("name", "") or "").strip())
            try:
                listeners = int(x.get("listeners") or 0)
            except (TypeError, ValueError):
                listeners = 0
            out.append({"name": name, "artist": artist, "listeners": listeners})
    except Exception:
        return []

    # Rank: exact/prefix matches first, then by listeners.
    ql = query.lower()

    def _rank(r):
        nl = r["name"].lower()
        if nl == ql:
            return (0, 0)
        if nl.startswith(ql):
            return (1, -r["listeners"])
        return (2, -r["listeners"])

    out.sort(key=_rank)
    _CACHE[key] = (out, time.monotonic() + _TTL)
    if len(_CACHE) > 500:
        for k in list(_CACHE.keys())[:100]:
            _CACHE.pop(k, None)
    return out


def _choice(name: str, value: str):
    from discord import app_commands
    name = (name or "").strip()[:100] or "?"
    value = (value or "").strip()[:100] or "?"
    return app_commands.Choice(name=name, value=value)


async def artist_ac(interaction, current: str):
    """Autocomplete an artist param."""
    results = await _search("artist", current or "")
    return [_choice(r["name"], r["name"]) for r in results[:25]]


async def _track_ac(interaction, current: str, sep: str):
    """Autocomplete an 'Artist{sep}Track' param (server uses ' - ', globals ' | ')."""
    cur = (current or "").strip()
    if len(cur) < 2:
        return []
    if sep in cur:
        a_part, t_part = [p.strip() for p in cur.split(sep, 1)]
        query = t_part or a_part
    else:
        a_part, query = None, cur
    results = await _search("track", query)
    out = []
    for r in results[:25]:
        artist = a_part or r.get("artist") or ""
        label = f"{r['name']} by {artist}" if artist else r["name"]
        value = f"{artist}{sep}{r['name']}" if artist else r["name"]
        out.append(_choice(label, value))
    return out


async def _album_ac(interaction, current: str, sep: str):
    cur = (current or "").strip()
    if len(cur) < 2:
        return []
    if sep in cur:
        a_part, t_part = [p.strip() for p in cur.split(sep, 1)]
        query = t_part or a_part
    else:
        a_part, query = None, cur
    results = await _search("album", query)
    out = []
    for r in results[:25]:
        artist = a_part or r.get("artist") or ""
        label = f"{r['name']} by {artist}" if artist else r["name"]
        value = f"{artist}{sep}{r['name']}" if artist else r["name"]
        out.append(_choice(label, value))
    return out


async def track_dash_ac(interaction, current: str):
    return await _track_ac(interaction, current, " - ")


async def track_pipe_ac(interaction, current: str):
    return await _track_ac(interaction, current, " | ")


async def album_dash_ac(interaction, current: str):
    return await _album_ac(interaction, current, " - ")


async def album_pipe_ac(interaction, current: str):
    return await _album_ac(interaction, current, " | ")
