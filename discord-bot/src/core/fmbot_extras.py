"""Backend processors for .fmbot-parity features.

All functions follow the existing convention: return (embed, None)
or (embed, view). Imports are local to avoid circulars (same style as
src/core/events.py, server_leaderboards.py, global_whoknows.py).
"""
import asyncio
import math
import random
import urllib.parse
from datetime import datetime, timezone


def _err(desc):
    from src.core.theme import Theme
    return Theme.get_error_embed(description=desc), None


async def _lname(user):
    from src.core.events import get_lastfm_username
    return await get_lastfm_username(user.id)


async def _color(user):
    from src.core.events import get_color
    return await get_color(user.id)


def _embed(user, title, desc, color=None, thumb=None):
    from src.core.theme import Theme
    from src.core.database import format_name
    e = Theme.get_embed(description=desc, color=color)
    e.set_author(name=title, icon_url=user.display_avatar.url)
    e.set_footer(text=f"Requested by {format_name(user)}")
    if thumb:
        e.set_thumbnail(url=thumb)
    return e


# ---------- Phase 1: overview / recap / year ----------

async def process_overview(user, target=None, days=4):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    days = max(1, min(8, int(days or 4)))
    from src.utils.api import fetch_top_artists, fetch_top_albums, fetch_top_tracks, fetch_user_profile
    color = await _color(user)
    ta = await fetch_top_artists(lname, "7day", 1)
    tb = await fetch_top_albums(lname, "7day", 1)
    tt = await fetch_top_tracks(lname, "7day", 1)
    prof = await fetch_user_profile(lname)
    total = "?"
    try:
        total = f"{int(prof['user']['playcount']):,}"
    except Exception:
        pass
    def _pick(data, *keys):
        try:
            node = data
            for k in keys:
                node = node[k]
            item = node[0] if isinstance(node, list) else node
            return item
        except Exception:
            return None
    a = _pick(ta, "topartists", "artist")
    b = _pick(tb, "topalbums", "album")
    t = _pick(tt, "toptracks", "track")
    lines = [f"**{total}** total scrobbles • last ~{days} days snapshot"]
    if t:
        lines.append(f"🔥 Top track (7d): **{t.get('name')}** by **{t.get('artist', {}).get('name', '?')}** ({t.get('playcount', '?')} plays)")
    if b:
        an = b.get("artist", {}).get("name", "?") if isinstance(b.get("artist"), dict) else b.get("artist", "?")
        lines.append(f"💿 Top album (7d): **{b.get('name')}** by **{an}** ({b.get('playcount', '?')} plays)")
    if a:
        lines.append(f"🎤 Top artist (7d): **{a.get('name')}** ({a.get('playcount', '?')} plays)")
    if len(lines) == 1:
        lines.append("No recent plays found.")
    return _embed(user, f"Overview for {lname}", "\n".join(lines), color), None


async def process_recap(user, target=None, period="7day"):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_top_artists, fetch_top_albums, fetch_top_tracks
    color = await _color(user)
    ta = await fetch_top_artists(lname, period, 5)
    tb = await fetch_top_albums(lname, period, 5)
    tt = await fetch_top_tracks(lname, period, 5)
    def _fmt(items, kind):
        try:
            arr = items[kind[0]][kind[1]]
            arr = arr if isinstance(arr, list) else [arr]
            out = []
            for i, x in enumerate(arr[:5]):
                if kind[1] == "artist":
                    out.append(f"`{i+1}.` **{x['name']}** — {x.get('playcount', '?')} plays")
                elif kind[1] == "album":
                    an = x["artist"]["name"] if isinstance(x.get("artist"), dict) else x.get("artist")
                    out.append(f"`{i+1}.` **{x['name']}** by **{an}** — {x.get('playcount', '?')}")
                else:
                    an = x["artist"]["name"] if isinstance(x.get("artist"), dict) else x.get("artist")
                    out.append(f"`{i+1}.` **{x['name']}** by **{an}** — {x.get('playcount', '?')}")
            return "\n".join(out) or "No data."
        except Exception:
            return "No data."
    desc = (f"**Top artists ({period})**\n{_fmt(ta, ('topartists', 'artist'))}\n\n"
            f"**Top albums ({period})**\n{_fmt(tb, ('topalbums', 'album'))}\n\n"
            f"**Top tracks ({period})**\n{_fmt(tt, ('toptracks', 'track'))}")
    return _embed(user, f"Recap for {lname} • {period}", desc, color), None


async def process_year(user, target=None, year=None):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    import datetime as _dt
    year = int(year) if year else _dt.datetime.now().year
    from src.utils.api import fetch_top_artists, fetch_top_albums, fetch_top_tracks
    color = await _color(user)
    # Last.fm has no native year period; use 12month as best-effort proxy.
    ta = await fetch_top_artists(lname, "12month", 5)
    tb = await fetch_top_albums(lname, "12month", 5)
    tt = await fetch_top_tracks(lname, "12month", 5)
    def _top(items, k1, k2):
        try:
            arr = items[k1][k2]
            arr = arr if isinstance(arr, list) else [arr]
            x = arr[0]
            if k2 == "artist":
                return f"**{x['name']}** ({x.get('playcount', '?')} plays)"
            an = x["artist"]["name"] if isinstance(x.get("artist"), dict) else x.get("artist")
            return f"**{x['name']}** by **{an}** ({x.get('playcount', '?')} plays)"
        except Exception:
            return "No data."
    desc = (f"📅 **{year} overview for {lname}** (12-month proxy)\n\n"
            f"🎤 Artist: {_top(ta, 'topartists', 'artist')}\n"
            f"💿 Album: {_top(tb, 'topalbums', 'album')}\n"
            f"🔥 Track: {_top(tt, 'toptracks', 'track')}")
    return _embed(user, f"Year {year} • {lname}", desc, color), None


# ---------- Phase 1: plays / pace / milestone ----------

async def process_plays(user, target=None, period="overall"):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_user_profile, fetch_top_artists
    color = await _color(user)
    prof = await fetch_user_profile(lname)
    try:
        total = int(prof["user"]["playcount"])
    except Exception:
        return _err("Could not fetch playcount from Last.fm.")
    if period == "overall":
        return _embed(user, f"Plays for {lname}", f"🎧 **{total:,}** total scrobbles."), None
    # period proxy: sum top artists for that period
    data = await fetch_top_artists(lname, period, 200)
    try:
        arr = data["topartists"]["artist"]
        arr = arr if isinstance(arr, list) else [arr]
        s = sum(int(a.get("playcount", 0)) for a in arr)
        return _embed(user, f"Plays for {lname} • {period}", f"🎧 **{s:,}** plays ({period}).\n*Estimated from top-artist sums; Last.fm has no exact period total.*"), None
    except Exception:
        return _embed(user, f"Plays for {lname}", f"🎧 **{total:,}** total scrobbles."), None


async def process_pace(user, target=None, goal=10000, period="overall"):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_user_profile, fetch_recent_tracks
    color = await _color(user)
    prof = await fetch_user_profile(lname)
    try:
        total = int(prof["user"]["playcount"])
    except Exception:
        return _err("Could not fetch playcount.")
    goal = int(goal)
    if goal <= total:
        return _embed(user, f"Pace for {lname}", f"✅ Already at **{total:,}** (goal **{goal:,}**)."), None
    # estimate daily rate from last 200 recents
    try:
        data = await fetch_recent_tracks(lname, 200, 1)
        tracks = data["recenttracks"]["track"]
        tracks = tracks if isinstance(tracks, list) else [tracks]
        uts = []
        for t in tracks:
            try:
                if "date" in t:
                    uts.append(int(t["date"]["uts"]))
            except Exception:
                pass
        if len(uts) >= 2:
            span_days = max(1, (max(uts) - min(uts)) / 86400)
            rate = len(uts) / span_days
        else:
            rate = 10.0
    except Exception:
        rate = 10.0
    rate = max(rate, 0.5)
    remaining = goal - total
    days_left = remaining / rate
    eta = datetime.now(timezone.utc).timestamp() + days_left * 86400
    eta_s = datetime.fromtimestamp(eta, tz=timezone.utc).strftime("%Y-%m-%d")
    desc = (f"🎯 Goal: **{goal:,}** • now **{total:,}** (**{remaining:,}** to go)\n"
            f"📈 Rate: **{rate:.1f}**/day → ETA **{eta_s}** (~{days_left:.0f} days)")
    return _embed(user, f"Pace for {lname}", desc, color), None


async def process_milestone(user, target=None, amount=None):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_user_profile, fetch_recent_tracks
    color = await _color(user)
    prof = await fetch_user_profile(lname)
    try:
        total = int(prof["user"]["playcount"])
    except Exception:
        return _err("Could not fetch playcount.")
    if amount:
        try:
            m = int(str(amount).replace(",", ""))
        except Exception:
            m = total
        # find the m-th scrobble = page through recents
        per = 200
        page = max(1, (m // per) + 1) if m <= 100000 else 1
        data = await fetch_recent_tracks(lname, min(per, m), page)
        try:
            tracks = data["recenttracks"]["track"]
            tracks = tracks if isinstance(tracks, list) else [tracks]
            idx = (m - 1) % per
            t = tracks[idx] if idx < len(tracks) else tracks[-1]
            an = t["artist"]["#text"] if isinstance(t.get("artist"), dict) else t.get("artist")
            date = t.get("date", {}).get("#text", "unknown date")
            return _embed(user, f"Milestone {m:,} • {lname}",
                           f"🎉 Scrobble **#{m:,}**: **{t.get('name')}** by **{an}**\n📅 {date}"), None
        except Exception:
            pass
        nxt = 10 ** math.ceil(math.log10(max(total + 1, 2)))
        return _embed(user, f"Milestones • {lname}",
                       f"🎧 Total: **{total:,}**\n🎯 Next: **{nxt:,}** ({nxt - total:,} to go)"), None
    nxt = 10 if total < 10 else 10 ** math.ceil(math.log10(total + 1))
    prev = nxt // 10
    return _embed(user, f"Milestones • {lname}",
                   f"🎧 Total: **{total:,}**\n✅ Last: **{prev:,}**\n🎯 Next: **{nxt:,}** ({nxt - total:,} to go)"), None


# ---------- Phase 1: genre / country ----------

async def process_genre(user, artist=None):
    from src.utils.api import fetch_now_playing, fetch_artist_info
    lname = await _lname(user)
    if not lname:
        return _err("Link your account with `/login` first.")
    color = await _color(user)
    if not artist:
        np_data = await fetch_now_playing(lname, 1)
        try:
            artist = np_data["recenttracks"]["track"][0]["artist"]["#text"]
        except Exception:
            return _err("Provide an artist name or play something.")
    info = await fetch_artist_info(lname, artist)
    try:
        tags = info["artist"]["tags"]["tag"]
        tags = tags if isinstance(tags, list) else [tags]
        names = [t["name"] for t in tags[:8]]
        desc = f"🏷️ Genres for **{artist}**:\n" + (", ".join(f"`{n}`" for n in names) if names else "No tags on Last.fm.")
        return _embed(user, f"Genre • {artist}", desc, color), None
    except Exception:
        return _err(f"No genre info for **{artist}**.")


async def process_country(user, artist=None):
    from src.utils.api import fetch_now_playing, fetch_musicbrainz_artist_info
    lname = await _lname(user)
    if not lname:
        return _err("Link your account with `/login` first.")
    color = await _color(user)
    if not artist:
        np_data = await fetch_now_playing(lname, 1)
        try:
            artist = np_data["recenttracks"]["track"][0]["artist"]["#text"]
        except Exception:
            return _err("Provide an artist name or play something.")
    from src.core.events import bot as _bot
    mb = await fetch_musicbrainz_artist_info(getattr(_bot, "session", None), artist)
    if mb and (mb.get("country") or mb.get("start_date")):
        desc = (f"🌍 **{artist}**\nCountry: `{mb.get('country') or 'unknown'}`\n"
                f"Type: `{mb.get('type') or 'unknown'}`\nActive since: `{mb.get('start_date') or 'unknown'}`")
        return _embed(user, f"Country • {artist}", desc, color), None
    return _err(f"No country info for **{artist}** (MusicBrainz lookup failed).")


async def process_countrychart(user, target=None, period="overall", limit=10):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_top_artists, fetch_musicbrainz_artist_info
    from src.core.events import bot as _bot
    color = await _color(user)
    data = await fetch_top_artists(lname, period, 50)
    try:
        arr = data["topartists"]["artist"]
        arr = arr if isinstance(arr, list) else [arr]
    except Exception:
        return _err("No top artists found.")
    session = getattr(_bot, "session", None)
    counts = {}
    for a in arr[:50]:
        mb = await fetch_musicbrainz_artist_info(session, a["name"])
        c = (mb or {}).get("country") or "Unknown"
        counts[c] = counts.get(c, 0) + int(a.get("playcount", 0))
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    lines = [f"`{i+1}.` **{c}** — {p:,} plays" for i, (c, p) in enumerate(top)]
    return _embed(user, f"Country chart • {lname} ({period})", "\n".join(lines) or "No data.", color), None


# ---------- Phase 1: leaderboards / affinity / friends extras ----------

async def process_scrobbleleaderboard(guild, user):
    from src.core.events import get_all_valid_users, get_lastfm_username
    from src.utils.api import fetch_user_profile
    if not guild:
        return _err("Must be used in a server.")
    linked = await get_all_valid_users(guild)
    if not linked:
        return _err("No linked users in this server.")
    color = await _color(user)
    rows = []
    for uid in list(linked.keys())[:50]:
        ln = linked[uid] or await get_lastfm_username(int(uid))
        if not ln:
            continue
        try:
            p = await fetch_user_profile(ln)
            rows.append((uid, ln, int(p["user"]["playcount"])))
        except Exception:
            continue
    rows.sort(key=lambda x: x[2], reverse=True)
    rows = rows[:15]
    if not rows:
        return _err("No data.")
    from src.core.database import format_name
    from src.core.events import bot as _bot
    lines = []
    for i, (uid, ln, pc) in enumerate(rows):
        m = guild.get_member(int(uid)) if guild else None
        name = format_name(m) if m else ln
        lines.append(f"`{i+1}.` **{name}** — **{pc:,}** plays")
    e = _embed(user, f"Scrobble leaderboard • {guild.name}", "\n".join(lines), color)
    if guild.icon:
        e.set_author(name=f"Scrobble leaderboard • {guild.name}", icon_url=guild.icon.url)
    return e, None


async def process_timeleaderboard(guild, user):
    # Proxy: imported listening ms + 3.5min * Last.fm plays estimate
    from src.core.events import get_all_valid_users, get_lastfm_username
    from src.utils.api import fetch_user_profile
    if not guild:
        return _err("Must be used in a server.")
    linked = await get_all_valid_users(guild)
    if not linked:
        return _err("No linked users in this server.")
    color = await _color(user)
    rows = []
    for uid in list(linked.keys())[:50]:
        ln = linked[uid] or await get_lastfm_username(int(uid))
        if not ln:
            continue
        try:
            p = await fetch_user_profile(ln)
            pc = int(p["user"]["playcount"])
            rows.append((uid, ln, pc * 3.5))  # minutes
        except Exception:
            continue
    rows.sort(key=lambda x: x[2], reverse=True)
    rows = rows[:15]
    from src.core.database import format_name
    lines = [f"`{i+1}.` **{(guild.get_member(int(uid)).display_name if guild.get_member(int(uid)) else ln)}** — **{m/60:.1f}h** est."
             for i, (uid, ln, m) in enumerate(rows)]
    return _embed(user, f"Listening-time leaderboard • {guild.name}", "\n".join(lines) or "No data.", color), None


async def process_affinity(guild, user):
    from src.core.events import get_all_valid_users, get_combined_top_artists, get_lastfm_username
    if not guild:
        return _err("Must be used in a server.")
    linked = await get_all_valid_users(guild)
    if not linked:
        return _err("No linked users in this server.")
    color = await _color(user)
    me_lname = await _lname(user)
    if not me_lname:
        return _err("Link your account with `/login` first.")
    mine = await get_combined_top_artists(str(user.id), me_lname, 50)
    my_set = {a["name"].lower() for a in mine}
    if not my_set:
        return _err("You have no top artists yet.")
    scored = []
    for uid in linked:
        if str(uid) == str(user.id):
            continue
        try:
            ln = linked[uid] or await get_lastfm_username(int(uid))
            if not ln:
                continue
            theirs = await get_combined_top_artists(str(uid), ln, 50)
            t_set = {a["name"].lower() for a in theirs}
            if not t_set:
                continue
            inter = len(my_set & t_set)
            union = len(my_set | t_set)
            score = inter / union if union else 0
            scored.append((uid, ln, score, inter))
        except Exception:
            continue
    scored.sort(key=lambda x: x[2], reverse=True)
    from src.core.database import format_name
    lines = []
    for i, (uid, ln, s, inter) in enumerate(scored[:10]):
        m = guild.get_member(int(uid))
        name = format_name(m) if m else ln
        lines.append(f"`{i+1}.` **{name}** — **{s:.0%}** ({inter} shared)")
    return _embed(user, f"Taste affinity • {guild.name}", "\n".join(lines) or "No comparable users.", color), None


async def process_friendswhoknow(user, bot, artist=None):
    from src.core.database import get_friends
    from src.core.events import get_lastfm_username, get_combined_playcount
    lname = await _lname(user)
    if not lname:
        return _err("Link your account with `/login` first.")
    if not artist:
        from src.utils.api import fetch_now_playing
        np_data = await fetch_now_playing(lname, 1)
        try:
            artist = np_data["recenttracks"]["track"][0]["artist"]["#text"]
        except Exception:
            return _err("Provide an artist name or play something.")
    friends = await get_friends(str(user.id)) or []
    ids = [str(user.id)] + [str(f.get("id") or f.get("friend_id")) for f in friends if isinstance(f, dict)]
    ids = [i for i in ids if i and i != "None"][:20]
    session = getattr(bot, "session", None)
    rows = []
    for uid in ids:
        try:
            ln = await get_lastfm_username(int(uid))
            pc = await get_combined_playcount(session, int(uid), ln, artist) if ln else 0
            if pc > 0:
                rows.append((uid, pc))
        except Exception:
            continue
    rows.sort(key=lambda x: x[1], reverse=True)
    color = await _color(user)
    from src.core.database import format_name
    lines = []
    for i, (uid, pc) in enumerate(rows[:15]):
        m = bot.get_user(int(uid))
        name = format_name(m) if m else f"User {uid}"
        lines.append(f"`{i+1}.` **{name}** — **{pc:,}** plays")
    return _embed(user, f"Friends who know {artist}", "\n".join(lines) or "No friends listen to this yet.", color), None


async def process_friends_list(user, bot):
    from src.core.database import get_friends, format_name
    color = await _color(user)
    friends = await get_friends(str(user.id)) or []
    if not friends:
        return _embed(user, "Friends", "You have no friends yet. Use `/social addfriend`."), None
    lines = []
    for f in friends[:20]:
        fid = f.get("friend_id") or f.get("id") or f.get("user_id")
        uname = f.get("friend_username") or f.get("username") or fid
        try:
            du = bot.get_user(int(fid)) if fid else None
            name = format_name(du) if du else uname
        except Exception:
            name = uname
        lines.append(f"• **{name}**")
    return _embed(user, f"Friends ({len(friends)})", "\n".join(lines), color), None


# ---------- Phase 2: discovery / search / iceberg / gaps ----------

async def _scan_recent(lname, max_pages=5, per=200):
    from src.utils.api import fetch_recent_tracks
    all_t = []
    for page in range(1, max_pages + 1):
        try:
            d = await fetch_recent_tracks(lname, per, page)
            tracks = d["recenttracks"]["track"]
            tracks = tracks if isinstance(tracks, list) else [tracks]
            # filter now-playing (no date)
            tracks = [t for t in tracks if "date" in t]
            if not tracks:
                break
            all_t.extend(tracks)
            total_pages = int(d["recenttracks"].get("@attr", {}).get("totalPages", page))
            if page >= total_pages:
                break
        except Exception:
            break
    return all_t


async def process_discoverydate(user, query=None):
    lname = await _lname(user)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_now_playing
    artist = track = album = None
    if query and "-" in query:
        parts = [p.strip() for p in query.split("-", 1)]
        if len(parts) == 2:
            artist, track = parts
    if not artist:
        np_data = await fetch_now_playing(lname, 1)
        try:
            t0 = np_data["recenttracks"]["track"][0]
            artist = t0["artist"]["#text"]
            track = t0["name"]
            album = t0["album"]["#text"]
        except Exception:
            return _err("Provide `Artist - Track` or play something.")
    tracks = await _scan_recent(lname)
    first_a = first_t = None
    for t in reversed(tracks):  # oldest first
        an = t["artist"]["#text"] if isinstance(t.get("artist"), dict) else ""
        tn = t.get("name", "")
        if an.lower() == artist.lower() and first_a is None:
            first_a = t
        if track and an.lower() == artist.lower() and tn.lower() == track.lower() and first_t is None:
            first_t = t
    color = await _color(user)
    lines = [f"🔍 Discovery dates for **{track or artist}**"]
    if first_t:
        lines.append(f"🎵 Track: **{first_t.get('date', {}).get('#text', '?')}**")
    if first_a:
        lines.append(f"🎤 Artist **{artist}**: **{first_a.get('date', {}).get('#text', '?')}**")
    if len(lines) == 1:
        lines.append("Not found in recent history scan (last ~1000 scrobbles).")
    return _embed(user, f"Discovered • {artist}", "\n".join(lines), color), None


async def process_lastlistened(user, query=None):
    lname = await _lname(user)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_now_playing
    artist = track = None
    if query and "-" in query:
        parts = [p.strip() for p in query.split("-", 1)]
        if len(parts) == 2:
            artist, track = parts
    if not artist:
        np_data = await fetch_now_playing(lname, 1)
        try:
            t0 = np_data["recenttracks"]["track"][0]
            artist = t0["artist"]["#text"]
            track = t0["name"]
        except Exception:
            return _err("Provide `Artist - Track` or play something.")
    tracks = await _scan_recent(lname, max_pages=2)
    hit = None
    for t in tracks:
        an = t["artist"]["#text"] if isinstance(t.get("artist"), dict) else ""
        tn = t.get("name", "")
        if track:
            if an.lower() == artist.lower() and tn.lower() == track.lower():
                hit = t
                break
        elif an.lower() == artist.lower():
            hit = t
            break
    color = await _color(user)
    if hit:
        an = hit["artist"]["#text"] if isinstance(hit.get("artist"), dict) else artist
        return _embed(user, f"Last listened • {an} - {hit.get('name')}",
                       f"🕒 **{hit.get('date', {}).get('#text', '?')}**", color), None
    return _err("Not found in recent history.")


async def process_discoveries(user, target=None):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    tracks = await _scan_recent(lname, max_pages=3)
    seen = {}
    for t in reversed(tracks):
        an = (t["artist"]["#text"] if isinstance(t.get("artist"), dict) else "").strip()
        if an and an.lower() not in seen and "date" in t:
            seen[an.lower()] = (an, t["date"].get("#text", "?"))
    firsts = list(seen.values())[:10]
    color = await _color(user)
    lines = [f"• **{a}** — {d}" for a, d in firsts] or ["No data."]
    return _embed(user, f"Recent discoveries • {lname}", "\n".join(lines), color), None


async def process_search(user, query, target=None):
    who = target or user
    lname = await _lname(who)
    if not lname or not query:
        return _err("Usage: `/search <query>`.")
    from src.utils.api import fetch_top_artists, fetch_top_albums, fetch_top_tracks
    color = await _color(user)
    q = query.lower()
    hits = []
    for fetcher, k1, k2, emoji in ((fetch_top_artists, "topartists", "artist", "🎤"),
                                   (fetch_top_albums, "topalbums", "album", "💿"),
                                   (fetch_top_tracks, "toptracks", "track", "🔥")):
        try:
            d = await fetcher(lname, "overall", 200)
            arr = d[k1][k2]
            arr = arr if isinstance(arr, list) else [arr]
            for x in arr:
                name = x.get("name", "")
                if q in name.lower():
                    hits.append(f"{emoji} **{name}** — {x.get('playcount', '?')} plays")
                    if len(hits) >= 15:
                        break
        except Exception:
            continue
    return _embed(user, f"Search `{query}` • {lname}", "\n".join(hits[:15]) or "No matches in your top library.", color), None


async def process_iceberg(user, target=None, period="overall"):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_top_artists, fetch_artist_info
    color = await _color(user)
    data = await fetch_top_artists(lname, period, 50)
    try:
        arr = data["topartists"]["artist"]
        arr = arr if isinstance(arr, list) else [arr]
    except Exception:
        return _err("No top artists.")
    tiers = {"🌊 Mainstream": [], "🧊 Deep": [], "🕳️ Abyss": []}
    for a in arr[:30]:
        try:
            info = await fetch_artist_info(lname, a["name"])
            listeners = int(info["artist"]["stats"]["listeners"])
        except Exception:
            listeners = 0
        if listeners > 500000:
            tiers["🌊 Mainstream"].append(a["name"])
        elif listeners > 50000:
            tiers["🧊 Deep"].append(a["name"])
        else:
            tiers["🕳️ Abyss"].append(a["name"])
    desc = ""
    for tier, names in tiers.items():
        desc += f"\n**{tier}**\n" + (", ".join(f"`{n}`" for n in names[:10]) or "_none_") + "\n"
    return _embed(user, f"Iceberg • {lname} ({period})", desc, color), None


async def process_gaps(user, target=None, days=30):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import fetch_top_artists
    color = await _color(user)
    tracks = await _scan_recent(lname, max_pages=3)
    recent_artists = set()
    for t in tracks:
        an = t["artist"]["#text"] if isinstance(t.get("artist"), dict) else ""
        if an:
            recent_artists.add(an.lower())
    data = await fetch_top_artists(lname, "overall", 50)
    try:
        arr = data["topartists"]["artist"]
        arr = arr if isinstance(arr, list) else [arr]
    except Exception:
        return _err("No top artists.")
    gaps = [a["name"] for a in arr[:30] if a["name"].lower() not in recent_artists][:10]
    desc = ("Artists you love but haven't played recently:\n" +
            "\n".join(f"• **{n}**" for n in gaps)) if gaps else "No gaps — you're keeping up with all your faves!"
    return _embed(user, f"Gaps • {lname}", desc, color), None


# ---------- Phase 2: lyrics / loved / scrobble / links ----------

async def process_lyrics_cmd(user, bot, query=None):
    from src.core.lyrics import fetch_lyrics
    from src.utils.api import fetch_now_playing
    lname = await _lname(user)
    artist = track = None
    if query and "-" in query:
        a, t = [p.strip() for p in query.split("-", 1)]
        artist, track = a, t
    elif lname:
        try:
            np_data = await fetch_now_playing(lname, 1)
            t0 = np_data["recenttracks"]["track"][0]
            artist = t0["artist"]["#text"]
            track = t0["name"]
        except Exception:
            pass
    if not artist or not track:
        return _err("Usage: `/lyrics Artist - Track` (or play something).")
    data = await fetch_lyrics(getattr(bot, "session", None), artist, track)
    color = await _color(user)
    if data and data.get("plain"):
        desc = data["plain"][:3900] + ("..." if len(data["plain"]) > 3900 else "")
        return _embed(user, f"Lyrics • {artist} - {track}", desc, color), None
    return _err(f"No lyrics found for **{track}** by **{artist}**.")


async def process_loved(user, target=None):
    who = target or user
    lname = await _lname(who)
    if not lname:
        return _err("Link your account with `/login` first.")
    from src.utils.api import api_get
    from src.core.config import LASTFM_API_KEY
    color = await _color(user)
    d = await api_get(f"https://ws.audioscrobbler.com/2.0/?method=user.getlovedtracks&user={lname}&api_key={LASTFM_API_KEY}&format=json&limit=10",
                      cache_ttl=300)
    try:
        arr = d["lovedtracks"]["track"]
        arr = arr if isinstance(arr, list) else [arr]
        lines = [f"❤️ **{t['name']}** by **{t['artist']['name']}**" for t in arr[:10]]
        return _embed(user, f"Loved tracks • {lname}", "\n".join(lines) or "No loved tracks.", color), None
    except Exception:
        return _err("Could not fetch loved tracks.")


def process_love_guidance(user):
    from src.core.theme import Theme
    from src.core.database import format_name
    e = Theme.get_embed(
        description=("❤️ **Love tracks on Last.fm**\n\n"
                     "Loving requires Last.fm write access. Re-run `/login` and approve "
                     "write permissions, then use Last.fm itself (or the website) to love. "
                     "Use `/loved` to view your loved tracks here."),
        color=0xFF4D6D)
    e.set_footer(text=f"Requested by {format_name(user)}")
    return e, None


def process_scrobble_guidance(user, query=None):
    from src.core.theme import Theme
    from src.core.database import format_name
    e = Theme.get_embed(
        description=("📻 **Manual scrobble**\n\n"
                     "Manual scrobbling needs a Last.fm session key with write scope.\n"
                     "1. `/login` and approve access\n"
                     "2. Play the track once more, *or* use `/outofsync` to backfill Spotify misses\n" +
                     (f"\nWanted: `{query}`" if query else "")),
        color=0x1DB954)
    e.set_footer(text=f"Requested by {format_name(user)}")
    return e, None


def process_link(user, kind, query):
    from src.core.theme import Theme
    from src.core.database import format_name
    q = urllib.parse.quote(query or "")
    urls = {
        "spotify": f"https://open.spotify.com/search/{q}",
        "applemusic": f"https://music.apple.com/us/search?term={q}",
        "youtube": f"https://www.youtube.com/results?search_query={q}",
    }
    url = urls.get(kind, urls["spotify"])
    e = Theme.get_embed(description=f"🔗 **{kind.title()}** for `{query}`:\n{url}")
    e.set_footer(text=f"Requested by {format_name(user)}")
    return e, None


# ---------- Phase 3: featured / customization / server ----------

async def process_featured(bot, user):
    from src.core.database import db_pool
    from src.utils.api import fetch_now_playing
    color = await _color(user)
    if not db_pool:
        return _err("Database offline.")
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT user_id, lastfm_username FROM user_settings WHERE lastfm_username IS NOT NULL LIMIT 100")
    except Exception:
        return _err("Could not pick a featured user.")
    if not rows:
        return _err("No linked users yet.")
    row = random.choice(list(rows))
    lname = row["lastfm_username"]
    try:
        d = await fetch_now_playing(lname, 1)
        t = d["recenttracks"]["track"][0]
        an = t["artist"]["#text"] if isinstance(t.get("artist"), dict) else "?"
        desc = f"🌟 Featured: **{lname}**\n🎵 **{t.get('name')}** by **{an}**"
    except Exception:
        desc = f"🌟 Featured: **{lname}**"
    try:
        await conn.execute("INSERT INTO global_settings (key, value) VALUES ('featured_log', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", f"{lname}|{datetime.now(timezone.utc).isoformat()}")
    except Exception:
        pass
    from src.core.database import format_name
    from src.core.theme import Theme
    e = Theme.get_embed(description=desc, color=color)
    e.set_footer(text=f"Requested by {format_name(user)} • hourly rotation")
    return e, None


async def process_featuredlog(user):
    from src.core.database import get_global_setting
    color = await _color(user)
    val = await get_global_setting("featured_log")
    return _embed(user, "Featured log", f"Last featured: `{val or 'none yet'}`"), None


# prefs stored in global_settings KV (no migration needed)
async def _pref_get(user_id, key, default=None):
    from src.core.database import get_global_setting
    v = await get_global_setting(f"user_{user_id}_{key}")
    return v if v is not None else default


async def _pref_set(user_id, key, value):
    from src.core.database import set_global_setting
    await set_global_setting(f"user_{user_id}_{key}", str(value))


async def process_responsemode(user, mode=None):
    if mode:
        await _pref_set(user.id, "responsemode", mode)
        return _embed(user, "Response mode", f"✅ Default layout → `{mode}` (`embed`/`image`/`pagination`)."), None
    cur = await _pref_get(user.id, "responsemode", "embed")
    return _embed(user, "Response mode", f"Current: `{cur}`\nSet with `/responsemode <embed|image|pagination>`."), None


async def process_userreactions(user, emojis=None):
    if emojis is not None:
        await _pref_set(user.id, "reactions", emojis or "")
        msg = "cleared." if not emojis else f"set to {emojis}"
        return _embed(user, "User reactions", f"✅ Auto-reactions {msg}"), None
    cur = await _pref_get(user.id, "reactions", "")
    return _embed(user, "User reactions", f"Current: `{cur or 'none'}`\nSet with `/userreactions 😀 😯`."), None


async def process_shortcuts(user, name=None, command=None):
    from src.core.database import get_global_setting, set_global_setting
    import json
    raw = await get_global_setting(f"user_{user.id}_shortcuts") or "{}"
    try:
        sc = json.loads(raw)
    except Exception:
        sc = {}
    if name and command:
        sc[name] = command
        await set_global_setting(f"user_{user.id}_shortcuts", json.dumps(sc))
        return _embed(user, "Shortcuts", f"✅ `.{name}` → `.{command}`"), None
    if name and not command:
        sc.pop(name, None)
        await set_global_setting(f"user_{user.id}_shortcuts", json.dumps(sc))
        return _embed(user, "Shortcuts", f"🗑️ Removed `.{name}`."), None
    body = "\n".join(f"• `.{k}` → `.{v}`" for k, v in sc.items()) or "No shortcuts. Add: `/shortcuts <name> <command>`"
    return _embed(user, "Shortcuts", body), None


async def process_localization(user, timezone_=None, number_format=None):
    if timezone_:
        from src.core.database import set_user_timezone
        await set_user_timezone(user.id, timezone_)
    if number_format:
        await _pref_set(user.id, "number_format", number_format)
    from src.core.database import get_user_timezone
    tz = await get_user_timezone(user.id)
    nf = await _pref_get(user.id, "number_format", "1,000")
    return _embed(user, "Localization", f"🌍 Timezone: `{tz}`\n🔢 Numbers: `{nf}`\n\nTip: `/localization timezone:Europe/Berlin format:1.000`"), None


async def process_members(guild, user):
    from src.core.events import get_all_valid_users
    if not guild:
        return _err("Must be used in a server.")
    linked = await get_all_valid_users(guild)
    color = await _color(user)
    return _embed(user, f"Members • {guild.name}", f"👥 **{len(linked)}** linked members."), None


async def process_togglecommand(guild, user, command, channel=None, enabled=True):
    from src.core.database import get_global_setting, set_global_setting
    import json
    if not guild:
        return _err("Must be used in a server.")
    raw = await get_global_setting(f"disabled_cmds_{guild.id}") or "{}"
    try:
        data = json.loads(raw)
    except Exception:
        data = {}
    key = f"{command}:{channel.id if channel else '*'}"
    if enabled:
        data.pop(key, None)
        msg = f"✅ Enabled `{command}`" + (f" in {channel.mention}" if channel else " server-wide")
    else:
        data[key] = True
        msg = f"🚫 Disabled `{command}`" + (f" in {channel.mention}" if channel else " server-wide")
    await set_global_setting(f"guild_{guild.id}_disabled_cmds", json.dumps(data))
    return _embed(user, "Toggle command", msg), None


async def process_autoposter(guild, user, channel=None, action="status"):
    from src.core.database import get_global_setting, set_global_setting
    key = f"guild_{guild.id}_autoposter" if guild else "autoposter"
    if action == "status" or not channel:
        cur = await get_global_setting(key) if guild else None
        return _embed(user, "Autoposter", f"Current channel: `{cur or 'not configured'}`\nSet: `/autoposter #channel` • off: `/autoposter off`"), None
    if channel == "off":
        await set_global_setting(key, "")
        return _embed(user, "Autoposter", "🛑 Autoposter disabled."), None
    await set_global_setting(key, str(getattr(channel, "id", channel)))
    ch = getattr(channel, "mention", channel)
    return _embed(user, "Autoposter", f"✅ Server listening digest will post in {ch}."), None


def process_botscrobbling_guidance(user):
    from src.core.theme import Theme
    from src.core.database import format_name
    e = Theme.get_embed(description=("🤖 **Music-bot scrobbling**\n\n"
                                     "Forward plays from Discord music bots to Last.fm:\n"
                                     "1. Give the bot access to the music channel\n"
                                     "2. `/botscrobbling on` (per-server toggle, owner)\n"
                                     "3. Plays detected as `Artist - Track` messages get scrobbled."),
                        color=0x5865F2)
    e.set_footer(text=f"Requested by {format_name(user)}")
    return e, None


async def process_botscrobbling(guild, user, enabled=None):
    from src.core.database import get_global_setting, set_global_setting
    if not guild:
        return _err("Must be used in a server.")
    key = f"guild_{guild.id}_botscrobbling"
    if enabled is None:
        cur = await get_global_setting(key) or "off"
        return _embed(user, "Bot scrobbling", f"Current: `{cur}`\n`/botscrobbling on|off` (Manage Server)."), None
    await set_global_setting(key, "on" if enabled else "off")
    return _embed(user, "Bot scrobbling", f"✅ {'Enabled' if enabled else 'Disabled'} for **{guild.name}**."), None


def process_discogs_guidance(user):
    from src.core.theme import Theme
    from src.core.database import format_name
    e = Theme.get_embed(description=("💿 **Discogs collection**\n\n"
                                     "Show your vinyl on `/profile`:\n"
                                     "1. Create a Discogs token (discogs.com/settings/developers)\n"
                                     "2. `/collection link <username>`\n"
                                     "3. `/collection` to browse."),
                        color=0x333333)
    e.set_footer(text=f"Requested by {format_name(user)}")
    return e, None
