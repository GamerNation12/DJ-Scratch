"""Read-only ListenBrainz API client (https://api.listenbrainz.org).

No API key needed for public listen data — only the LB username.
Mirrors the style of src/utils/api.py (shared bot session, short timeouts).
"""
import logging
import urllib.parse

LB_API_ROOT = "https://api.listenbrainz.org/1"


async def _lb_get(path, params=None, timeout_s=6):
    from src.core.events import bot
    import aiohttp

    url = LB_API_ROOT + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    try:
        async with bot.session.get(url, timeout=aiohttp.ClientTimeout(total=timeout_s)) as r:
            if r.status == 404:
                return None  # unknown user
            if r.status != 200:
                logging.error(f"ListenBrainz API status {r.status} for {path}")
                return None
            try:
                return await r.json()
            except Exception:
                logging.error("ListenBrainz: failed to parse JSON")
                return None
    except Exception as e:
        logging.error(f"ListenBrainz request failed: {e}")
        return None


async def fetch_lb_listen_count(lb_username):
    """Total scrobbles for a user. None if the user doesn't exist / error.
    Doubles as username validation when linking."""
    d = await _lb_get(f"/user/{urllib.parse.quote(lb_username)}/listen-count")
    try:
        return int(d["payload"]["count"])
    except Exception:
        return None


async def fetch_lb_playing_now(lb_username):
    """Returns (listen_dict_or_None, is_playing_bool)."""
    d = await _lb_get(f"/user/{urllib.parse.quote(lb_username)}/playing-now")
    try:
        payload = d["payload"]
        listens = payload.get("listens") or []
        if payload.get("playing_now") and listens:
            return listens[0], True
        return None, False
    except Exception:
        return None, False


async def fetch_lb_recent_listens(lb_username, count=2):
    """Most recent finished listens, newest first."""
    d = await _lb_get(f"/user/{urllib.parse.quote(lb_username)}/listens",
                      params={"count": max(1, min(count, 100))}, timeout_s=12)
    try:
        return d["payload"]["listens"] or []
    except Exception:
        return []


def lb_listen_parts(listen):
    """Normalize one LB listen -> (artist, track, release, listened_at_or_None)."""
    try:
        meta = listen.get("track_metadata", {}) or {}
        artist = (meta.get("artist_name") or "").strip()
        track = (meta.get("track_name") or "").strip()
        release = (meta.get("release_name") or "").strip()
        ts = listen.get("listened_at")
        return artist, track, release, int(ts) if ts else None
    except Exception:
        return "", "", "", None


def _lb_track_shape(artist, track, release, playing, uts=None):
    """Build a Last.fm-shaped track dict so process_fm flows unchanged."""
    t = {
        "artist": {"#text": artist},
        "name": track,
        "album": {"#text": release or ""},
        # No cover art from LB listens; process_fm's Spotify/Deezer/iTunes
        # fallbacks fill this in. Must have 4 entries: process_fm reads [3].
        "image": [{"#text": ""}, {"#text": ""}, {"#text": ""}, {"#text": ""}],
    }
    if playing:
        t["@attr"] = {"nowplaying": "true"}
    elif uts:
        t["date"] = {"uts": str(uts), "#text": ""}
    return t


async def fetch_lb_now_playing_shape(lb_username, depth=2):
    """Fetch LB playing-now + recents, shaped like Last.fm getrecenttracks.

    Returns {'recenttracks': {'track': [...]}} or None when LB has nothing.
    """
    now_listen, playing = await fetch_lb_playing_now(lb_username)
    tracks = []
    if playing and now_listen:
        a, t, r, _ = lb_listen_parts(now_listen)
        if a and t:
            tracks.append(_lb_track_shape(a, t, r, True))
    recents = await fetch_lb_recent_listens(lb_username, max(depth, 2))
    for listen in recents:
        a, t, r, ts = lb_listen_parts(listen)
        if not a or not t:
            continue
        # Don't duplicate the now-playing track as the "previous" track.
        if tracks and a.lower() == (tracks[0]["artist"]["#text"] or "").lower() \
                and t.lower() == (tracks[0]["name"] or "").lower() and playing:
            continue
        tracks.append(_lb_track_shape(a, t, r, False, ts))
        if len(tracks) >= depth:
            break
    if not tracks:
        return None
    return {"recenttracks": {"track": tracks, "@attr": {"user": lb_username}}}
