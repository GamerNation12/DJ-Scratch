"""Last.fm history sync: exact timestamp dedupe between scrobbles and imports.

Two frontiers per user (fm_sync_state):
- backfill_page: pages walk BACKWARD from the oldest page; each run takes a
  few pages, resumable across restarts. Done when page < 1.
- newest_uts: incremental frontier; each run takes newest pages and stores
  anything newer.

Inserts skip scrobbles already covered by an import within +/-180s
(same artist+track), and vice versa imports keep working untouched.
Small-host friendly: strictly page-at-a-time, no accumulation.
"""
import asyncio
from datetime import datetime, timezone

SYNC_SCHEMA_VERSION = "1"
BACKFILL_PAGES_PER_RUN = 5
INCREMENTAL_PAGES_PER_RUN = 2
DEDUPE_SECONDS = 180


async def ensure_sync_tables():
    try:
        import src.core.database as dbmod
        pool = dbmod.db_pool
        if not pool:
            return
        try:
            async with pool.acquire() as conn:
                v = await conn.fetchval(
                    "SELECT value FROM global_settings WHERE key = 'schema_fmsync_v'",
                    timeout=15)
                if v == SYNC_SCHEMA_VERSION:
                    return
        except Exception:
            pass
        async with pool.acquire() as conn:
            await conn.execute(
                """CREATE TABLE IF NOT EXISTS fm_sync_state (
                    user_id VARCHAR(255) PRIMARY KEY,
                    lastfm_username TEXT NOT NULL,
                    oldest_uts BIGINT DEFAULT 0,
                    newest_uts BIGINT DEFAULT 0,
                    backfill_page INT,
                    backfill_done BOOLEAN DEFAULT FALSE,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )""", timeout=20)
            for ddl in (
                "ALTER TABLE listens ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'import'",
                "ALTER TABLE listens ADD COLUMN IF NOT EXISTS ms_played BIGINT",
                "ALTER TABLE listens ADD COLUMN IF NOT EXISTS spotify_uri TEXT",
                "CREATE INDEX IF NOT EXISTS idx_listens_user_played_src "
                "ON listens (user_id, played_at DESC)",
            ):
                try:
                    await conn.execute(ddl, timeout=20)
                except Exception:
                    pass
            try:
                await conn.execute(
                    "INSERT INTO global_settings (key, value) VALUES ('schema_fmsync_v', $1) "
                    "ON CONFLICT (key) DO UPDATE SET value = $1",
                    SYNC_SCHEMA_VERSION, timeout=20)
            except Exception:
                pass
    except Exception:
        pass


def _to_dt(uts: int):
    try:
        return datetime.fromtimestamp(int(uts), tz=timezone.utc)
    except Exception:
        return None


async def _fetch_recent_page(username: str, page: int, limit: int = 200):
    try:
        from src.utils.api import fetch_recent_tracks
        data = await fetch_recent_tracks(username, limit, page)
        tracks = (((data or {}).get("recenttracks") or {}).get("track")) or []
        total_pages = int((((data or {}).get("recenttracks") or {}).get("@attr") or {}).get("totalPages") or 1)
        return tracks, total_pages
    except Exception:
        return [], 1


async def _store_scrobbles(user_id: str, tracks) -> tuple[int, int, int]:
    """Insert one page of scrobbles with dedupe. Returns (inserted, dupes, min_uts, max_uts)."""
    import src.core.database as dbmod
    pool = dbmod.db_pool
    if not pool:
        return 0, 0, 0, 0
    inserted = dupes = 0
    lo_uts = hi_uts = 0
    try:
        async with pool.acquire() as conn:
            for t in tracks or []:
                try:
                    if isinstance(t.get("@attr"), dict) and t["@attr"].get("nowplaying") == "true":
                        continue
                    uts = int((t.get("date") or {}).get("uts") or 0)
                    if uts <= 0:
                        continue
                    artist = ((t.get("artist") or {}).get("#text") or t.get("artist") or "")
                    if isinstance(artist, dict):
                        artist = artist.get("#text") or ""
                    name = t.get("name") or ""
                    album = ((t.get("album") or {}).get("#text")) or ""
                    if not name or not artist:
                        continue
                    if not lo_uts or uts < lo_uts:
                        lo_uts = uts
                    if uts > hi_uts:
                        hi_uts = uts
                    dt = _to_dt(uts)
                    dupe = await conn.fetchval(
                        """SELECT 1 FROM listens l JOIN tracks t ON l.track_id = t.id
                           WHERE l.user_id = $1 AND LOWER(t.artist_name) = LOWER($2)
                           AND LOWER(t.track_name) = LOWER($3)
                           AND l.played_at BETWEEN $4 - make_interval(secs => 180)
                           AND $4 + make_interval(secs => 180) LIMIT 1""",
                        str(user_id), str(artist)[:255], str(name)[:255], dt)
                    if dupe:
                        dupes += 1
                        continue
                    await conn.execute(
                        """INSERT INTO tracks (artist_name, track_name, album_name)
                           VALUES ($1, $2, $3)
                           ON CONFLICT (artist_name, track_name, album_name) DO NOTHING""",
                        str(artist)[:255], str(name)[:255], str(album or "")[:255])
                    await conn.execute(
                        """INSERT INTO listens (user_id, track_id, played_at, source)
                           SELECT $1, t.id, $4, 'lastfm' FROM tracks t
                           WHERE t.artist_name = $2 AND t.track_name = $3
                           AND t.album_name = COALESCE($5, '')
                           ON CONFLICT (user_id, track_id, played_at) DO NOTHING""",
                        str(user_id), str(artist)[:255], str(name)[:255], dt, str(album or "")[:255])
                    inserted += 1
                except Exception:
                    continue
    except Exception:
        pass
    return inserted, dupes, lo_uts, hi_uts


async def sync_user_backfill(user_id: str, username: str, max_pages: int = BACKFILL_PAGES_PER_RUN) -> dict:
    """Walk a few oldest pages into the DB. Resumable; returns progress."""
    import src.core.database as dbmod
    pool = dbmod.db_pool
    result = {"inserted": 0, "dupes": 0, "done": False, "page": None}
    if not pool or not username:
        return result
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT backfill_page, backfill_done, newest_uts FROM fm_sync_state WHERE user_id = $1",
                str(user_id))
            if row and row["backfill_done"]:
                result["done"] = True
                return result
            page = row["backfill_page"] if row and row["backfill_page"] else None
            newest = int(row["newest_uts"] or 0) if row else 0
        if page is None:
            _, total = await _fetch_recent_page(username, 1)
            page = max(total, 1)
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO fm_sync_state (user_id, lastfm_username, backfill_page, newest_uts)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (user_id) DO UPDATE SET backfill_page = $3,
                       lastfm_username = $2, updated_at = CURRENT_TIMESTAMP""",
                    str(user_id), username, page, newest)
        oldest_seen = None
        for _ in range(max_pages):
            if page is not None and page < 1:
                break
            tracks, _ = await _fetch_recent_page(username, page or 1)
            if not tracks:
                break
            ins, dup, lo, _ = await _store_scrobbles(user_id, tracks)
            result["inserted"] += ins
            result["dupes"] += dup
            if lo and (oldest_seen is None or lo < oldest_seen):
                oldest_seen = lo
            page = (page or 1) - 1
            await asyncio.sleep(0.4)
        result["page"] = page
        async with pool.acquire() as conn:
            if page is not None and page < 1:
                await conn.execute(
                    "UPDATE fm_sync_state SET backfill_page = NULL, backfill_done = TRUE, "
                    "oldest_uts = COALESCE(LEAST(NULLIF(COALESCE(oldest_uts, 0), 0), $2), $2), "
                    "updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
                    str(user_id), oldest_seen or 0)
                result["done"] = True
            else:
                await conn.execute(
                    "UPDATE fm_sync_state SET backfill_page = $2, "
                    "oldest_uts = COALESCE(LEAST(NULLIF(COALESCE(oldest_uts, 0), 0), $3), $3), "
                    "updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
                    str(user_id), page, oldest_seen or 0)
    except Exception:
        pass
    return result


async def sync_user_incremental(user_id: str, username: str, max_pages: int = INCREMENTAL_PAGES_PER_RUN) -> dict:
    """Store scrobbles newer than the frontier (cheap: newest pages only)."""
    import src.core.database as dbmod
    pool = dbmod.db_pool
    result = {"inserted": 0, "dupes": 0}
    if not pool or not username:
        return result
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT newest_uts FROM fm_sync_state WHERE user_id = $1", str(user_id))
            frontier = int(row["newest_uts"] or 0) if row else 0
            if row is None:
                await conn.execute(
                    "INSERT INTO fm_sync_state (user_id, lastfm_username) VALUES ($1, $2) "
                    "ON CONFLICT (user_id) DO NOTHING", str(user_id), username)
        peak = frontier
        for page in range(1, max_pages + 1):
            tracks, _ = await _fetch_recent_page(username, page)
            if not tracks:
                break
            fresh = []
            for t in tracks:
                try:
                    if isinstance(t.get("@attr"), dict) and t["@attr"].get("nowplaying") == "true":
                        continue
                    uts = int((t.get("date") or {}).get("uts") or 0)
                    if uts > frontier:
                        fresh.append(t)
                        if uts > peak:
                            peak = uts
                except Exception:
                    continue
            if fresh:
                ins, dup, _, _ = await _store_scrobbles(user_id, fresh)
                result["inserted"] += ins
                result["dupes"] += dup
            else:
                break
            await asyncio.sleep(0.4)
        if peak > frontier:
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE fm_sync_state SET newest_uts = $2, updated_at = CURRENT_TIMESTAMP "
                    "WHERE user_id = $1", str(user_id), peak)
    except Exception:
        pass
    return result


async def sync_status(user_id: str) -> dict | None:
    try:
        import src.core.database as dbmod
        pool = dbmod.db_pool
        if not pool:
            return None
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT lastfm_username, oldest_uts, newest_uts, backfill_page, backfill_done, "
                "updated_at FROM fm_sync_state WHERE user_id = $1", str(user_id))
            if not row:
                return None
            synced = await conn.fetchval(
                "SELECT COUNT(*) FROM listens WHERE user_id = $1 AND COALESCE(source, 'import') = 'lastfm'",
                str(user_id))
            return {
                "username": row["lastfm_username"],
                "backfill_done": bool(row["backfill_done"]),
                "backfill_page": row["backfill_page"],
                "oldest": int(row["oldest_uts"] or 0),
                "newest": int(row["newest_uts"] or 0),
                "synced_scrobbles": int(synced or 0),
                "updated": str(row["updated_at"]),
            }
    except Exception:
        return None
