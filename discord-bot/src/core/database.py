from src.core.config import Log
import json
import os
import asyncpg
from datetime import datetime, timedelta
from .config import POSTGRES_URL, DATABASE_URL, Log, PERIOD_TO_DAYS

display_name_cache = {}
name_cache_task = None

# --- Hot-read TTL caches (avoid a DB round-trip per command) ---
import time as _time
_USER_BUNDLE_CACHE: dict = {}  # user_id -> (bundle_dict, expires)
_USER_BUNDLE_TTL = 120.0
_LASTFM_USER_CACHE: dict = {}  # user_id -> (username_or_None, expires)
_LASTFM_USER_TTL = 300.0


def _bundle_get(uid: str):
    e = _USER_BUNDLE_CACHE.get(uid)
    if e and e[1] > _time.monotonic():
        return e[0]
    return None


def _bundle_set(uid: str, bundle: dict):
    _USER_BUNDLE_CACHE[uid] = (bundle, _time.monotonic() + _USER_BUNDLE_TTL)
    if len(_USER_BUNDLE_CACHE) > 5000:
        _USER_BUNDLE_CACHE.pop(next(iter(_USER_BUNDLE_CACHE)))


def invalidate_user_cache(uid=None):
    if uid is None:
        _USER_BUNDLE_CACHE.clear()
        _LASTFM_USER_CACHE.clear()
    else:
        _USER_BUNDLE_CACHE.pop(str(uid), None)
        _LASTFM_USER_CACHE.pop(str(uid), None)


async def get_user_bundle(user_id):
    """Fetch frequently-used user settings in ONE query (cached 2 min)."""
    uid = str(user_id)
    cached = _bundle_get(uid)
    if cached is not None:
        return cached
    bundle = {
        'lastfm_username': None, 'fm_mode': 'full', 'show_features': False,
        'show_track_playcount': True, 'data_source': 'combined',
        'embed_color': None, 'timezone': 'UTC', 'private_mode': False,
        'update_notifs': True, 'last_update_seen': '',
    }
    if not db_pool:
        return bundle
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT lastfm_username, fm_mode, show_features, show_track_playcount,"
                " data_source, embed_color, timezone, private_mode,"
                " update_notifs, last_update_seen"
                " FROM user_settings WHERE user_id=$1", uid)
            if row:
                for k in bundle:
                    try:
                        v = row[k]
                    except Exception:
                        v = None
                    if v is not None:
                        bundle[k] = v
                if not bundle['fm_mode']:
                    bundle['fm_mode'] = 'full'
                if not bundle['data_source']:
                    bundle['data_source'] = 'combined'
                if not bundle['timezone']:
                    bundle['timezone'] = 'UTC'
    except Exception:
        pass
    _bundle_set(uid, bundle)
    if bundle['lastfm_username']:
        _LASTFM_USER_CACHE[uid] = (bundle['lastfm_username'], _time.monotonic() + _LASTFM_USER_TTL)
    return bundle

async def _poll_name_cache():
    import asyncio
    while True:
        await asyncio.sleep(60)
        await init_name_cache()

async def init_name_cache():
    global name_cache_task
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT user_id, display_name FROM user_settings WHERE display_name IS NOT NULL")
            new_cache = {}
            for row in rows:
                if row['display_name']:
                    new_cache[str(row['user_id'])] = row['display_name']
            display_name_cache.clear()
            display_name_cache.update(new_cache)
    except Exception as e:
        print(f"{Log.RED}>>> Error updating name cache: {e}{Log.RESET}")
        
    if name_cache_task is None:
        import asyncio
        name_cache_task = asyncio.create_task(_poll_name_cache())

def format_name(user):
    if not user: return "Unknown"
    
    uid = getattr(user, 'id', None)
    name = getattr(user, 'name', str(user))
    
    if uid and str(uid) in display_name_cache:
        name = display_name_cache[str(uid)]
        
    if name == "gamernation12":
        return "GamerNation12"
    if "goats dj" in name.lower() or "dj-scratch" in name.lower():
        return "DJ Scratch"
        
    return name
db_pool = None

async def init_db():
    global db_pool
    db_conn_string = POSTGRES_URL or DATABASE_URL
    if db_conn_string:
        try:
            db_pool = await asyncpg.create_pool(
                db_conn_string,
                min_size=1,
                max_size=5,
                max_inactive_connection_lifetime=30.0,
                # Required for Supabase pooler (PgBouncer transaction mode):
                # prepared statements don't survive the pooler.
                statement_cache_size=0
            )
            print(f"{Log.GREEN}>>> Database pool created successfully{Log.RESET}")
            async with db_pool.acquire() as conn:
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS user_settings (
                        user_id TEXT PRIMARY KEY,
                        lastfm_username TEXT,
                        fm_mode TEXT,
                        show_features BOOLEAN DEFAULT FALSE,
                        data_source TEXT DEFAULT 'combined',
                        timezone TEXT DEFAULT 'UTC',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS website_logs (
                        id SERIAL PRIMARY KEY,
                        user_id TEXT,
                        username TEXT,
                        action TEXT,
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS command_permissions (
                        user_id TEXT,
                        command_name TEXT,
                        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, command_name)
                    )
                ''')
                try:
                    await conn.execute("ALTER TABLE command_permissions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP")
                except Exception:
                    pass
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS friends (
                        user_id VARCHAR(255),
                        friend_id VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'pending',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, friend_id)
                    )
                ''')
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS direct_messages (
                        id SERIAL PRIMARY KEY,
                        sender_id VARCHAR(255),
                        receiver_id VARCHAR(255),
                        content TEXT NOT NULL,
                        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_access_token TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN spotify_refresh_token TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMP")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lastfm_username TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_track_playcount BOOLEAN DEFAULT TRUE")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN is_banned BOOLEAN DEFAULT FALSE")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN ban_reason TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN ban_expires_at TIMESTAMP")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embed_color TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN update_notifs BOOLEAN DEFAULT TRUE")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN last_update_seen TEXT DEFAULT ''")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN spotify_refresh_token TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS purge_warning_sent BOOLEAN DEFAULT FALSE")
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
                except Exception as e:
                    pass
                try:
                    await conn.execute("ALTER TABLE listens ADD COLUMN IF NOT EXISTS spotify_uri TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE listens ADD COLUMN IF NOT EXISTS ms_played BIGINT DEFAULT 0")
                except Exception:
                    pass
                for _idx_sql in (
                    "CREATE INDEX IF NOT EXISTS idx_listens_user_played ON listens (user_id, played_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_listens_track ON listens (track_id)",
                    "CREATE INDEX IF NOT EXISTS idx_tracks_names ON tracks (artist_name, track_name, album_name)",
                    "CREATE INDEX IF NOT EXISTS idx_server_crowns_guild ON server_crowns (guild_id)",
                ):
                    try:
                        await conn.execute(_idx_sql)
                    except Exception:
                        pass
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.RED}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
    
    await init_name_cache()



async def get_total_linked_users():
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) as total FROM user_settings WHERE lastfm_username IS NOT NULL")
            return row['total'] if row else 0
    except Exception:
        return 0

async def get_user_fm_mode(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('fm_mode') or 'full'
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT fm_mode FROM user_settings WHERE user_id=$1", str(user_id))
            return row['fm_mode'] if row and row['fm_mode'] is not None else 'full'
    except Exception:
        return 'full'

async def set_user_fm_mode(user_id, mode):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, fm_mode) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET fm_mode = $2
            """, str(user_id), mode)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting fm_mode: {e}{Log.RESET}")
    invalidate_user_cache(user_id)

async def get_user_private_mode(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('private_mode') or False
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT private_mode FROM user_settings WHERE user_id=$1", str(user_id))
            return row['private_mode'] if row and row['private_mode'] is not None else False
    except Exception:
        return False

async def get_user_show_features(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('show_features') or False
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT show_features FROM user_settings WHERE user_id=$1", str(user_id))
            return row['show_features'] if row and row['show_features'] is not None else False
    except Exception:
        return False

async def set_user_show_features(user_id, show_features: bool):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, show_features) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET show_features = $2
            """, str(user_id), show_features)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting show_features: {e}{Log.RESET}")
    invalidate_user_cache(user_id)

async def get_user_created_at(user_id):
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT created_at FROM user_settings WHERE user_id=$1", str(user_id))
            return row['created_at'] if row and row['created_at'] is not None else None
    except Exception:
        return None

async def get_user_show_track_playcount(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        v = b.get('show_track_playcount')
        return True if v is None else v
    if not db_pool: return True
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT show_track_playcount FROM user_settings WHERE user_id=$1", str(user_id))
            return row['show_track_playcount'] if row and row['show_track_playcount'] is not None else True
    except Exception:
        return True

async def get_user_embed_color(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('embed_color')
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT embed_color FROM user_settings WHERE user_id=$1", str(user_id))
            return row['embed_color'] if row else None
    except Exception:
        return None

async def set_user_embed_color(user_id, color_hex: str):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, embed_color) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET embed_color = $2
            """, str(user_id), color_hex)
    except Exception as e:
        print(f"Error setting embed_color: {e}")
    invalidate_user_cache(user_id)
async def set_user_show_track_playcount(user_id, show_track_playcount: bool):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, show_track_playcount) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET show_track_playcount = $2
            """, str(user_id), show_track_playcount)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting show_track_playcount: {e}{Log.RESET}")
    invalidate_user_cache(user_id)

async def fetch_user_avatar(user_id):
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT avatar_url FROM imported_users WHERE user_id=$1", str(user_id))
            if row: return row['avatar_url']
            
            row = await conn.fetchrow("SELECT avatar_url FROM profile_cache WHERE user_id=$1", str(user_id))
            return row['avatar_url'] if row else None
    except Exception:
        return None

# --- COMMAND PERMISSIONS ---

async def has_command_permission(user_id: str, command_name: str) -> bool:
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT expires_at FROM command_permissions WHERE user_id=$1 AND command_name=$2",
                str(user_id), command_name
            )
            if row:
                if row['expires_at'] and row['expires_at'] < datetime.utcnow():
                    await conn.execute("DELETE FROM command_permissions WHERE user_id=$1 AND command_name=$2", str(user_id), command_name)
                    return False
                return True
            return False
    except Exception as e:
        print(f"{Log.RED}>>> Error checking command permission: {e}{Log.RESET}")
        return False

async def has_any_command_permission(user_id: str) -> bool:
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            from datetime import datetime
            row = await conn.fetchrow(
                "SELECT 1 FROM command_permissions WHERE user_id=$1 AND (expires_at IS NULL OR expires_at > $2) LIMIT 1",
                str(user_id), datetime.utcnow()
            )
            return bool(row)
    except Exception as e:
        print(f"{Log.RED}>>> Error checking any command permission: {e}{Log.RESET}")
        return False

async def get_all_command_permissions():
    if not db_pool: return []
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT user_id, command_name, granted_at, expires_at FROM command_permissions ORDER BY granted_at DESC")
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"{Log.RED}>>> Error fetching command permissions: {e}{Log.RESET}")
        return []

async def add_command_permission(user_id: str, command_name: str, expires_at: datetime = None):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            if expires_at:
                await conn.execute(
                    "INSERT INTO command_permissions (user_id, command_name, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, command_name) DO UPDATE SET expires_at = EXCLUDED.expires_at",
                    str(user_id), command_name, expires_at
                )
            else:
                await conn.execute(
                    "INSERT INTO command_permissions (user_id, command_name) VALUES ($1, $2) ON CONFLICT (user_id, command_name) DO UPDATE SET expires_at = NULL",
                    str(user_id), command_name
                )
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error adding command permission: {e}{Log.RESET}")
        return False

async def remove_command_permission(user_id: str, command_name: str):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM command_permissions WHERE user_id=$1 AND command_name=$2",
                str(user_id), command_name
            )
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error removing command permission: {e}{Log.RESET}")
        return False

async def get_user_data_source(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('data_source') or 'combined'
    if not db_pool: return 'combined'
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT data_source FROM user_settings WHERE user_id=$1", str(user_id))
            return row['data_source'] if row and row['data_source'] is not None else 'combined'
    except Exception:
        return 'combined'

async def set_user_data_source(user_id, source):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, data_source) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET data_source = $2
            """, str(user_id), source)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting data_source: {e}{Log.RESET}")
    invalidate_user_cache(user_id)

async def get_user_timezone(user_id):
    b = _bundle_get(str(user_id))
    if b is not None:
        return b.get('timezone') or 'UTC'
    if not db_pool: return 'UTC'
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT timezone FROM user_settings WHERE user_id=$1", str(user_id))
            return row['timezone'] if row and row['timezone'] is not None else 'UTC'
    except Exception:
        return 'UTC'

async def get_user_update_notifs(uid):
    if not db_pool: return True
    async with db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT update_notifs FROM user_settings WHERE user_id = $1", str(uid))
        except asyncpg.exceptions.UndefinedColumnError:
            try:
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS update_notifs BOOLEAN DEFAULT TRUE")
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_update_seen TEXT DEFAULT ''")
                row = await conn.fetchrow("SELECT update_notifs FROM user_settings WHERE user_id = $1", str(uid))
            except Exception as e:
                print(f"Auto-recovery for update_notifs failed: {e}")
                return True
                
        if row and row['update_notifs'] is not None:
            return row['update_notifs']
        return True

async def set_user_update_notifs(uid, enabled: bool):
    invalidate_user_cache(uid)
    if not db_pool: return
    async with db_pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO user_settings (user_id, update_notifs) VALUES ($1, $2) "
                "ON CONFLICT (user_id) DO UPDATE SET update_notifs = EXCLUDED.update_notifs",
                str(uid), enabled
            )
        except Exception as e:
            print(f"{Log.RED}>>> Failed to set_user_update_notifs: {e}{Log.RESET}")

async def get_user_last_update_seen(uid):
    if not db_pool: return ''
    async with db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT last_update_seen FROM user_settings WHERE user_id = $1", str(uid))
        except asyncpg.exceptions.UndefinedColumnError:
            try:
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS update_notifs BOOLEAN DEFAULT TRUE")
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_update_seen TEXT DEFAULT ''")
                row = await conn.fetchrow("SELECT last_update_seen FROM user_settings WHERE user_id = $1", str(uid))
            except Exception as e:
                print(f"Auto-recovery for last_update_seen failed: {e}")
                return ''
                
        if row and row['last_update_seen'] is not None:
            return row['last_update_seen']
        return ''

async def set_user_last_update_seen(uid, version: str):
    invalidate_user_cache(uid)
    if not db_pool: return
    async with db_pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO user_settings (user_id, last_update_seen) VALUES ($1, $2) "
                "ON CONFLICT (user_id) DO UPDATE SET last_update_seen = EXCLUDED.last_update_seen",
                str(uid), version
            )
        except Exception as e:
            print(f"{Log.RED}>>> Failed to set_user_last_update_seen: {e}{Log.RESET}")

async def set_user_timezone(user_id, tz):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, timezone) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET timezone = $2
            """, str(user_id), tz)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting timezone: {e}{Log.RESET}")
    invalidate_user_cache(user_id)

async def get_local_total_plays(user_id):
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) FROM listens l JOIN tracks t ON l.track_id = t.id WHERE user_id=$1", str(user_id))
            return row['count'] if row else 0
    except Exception:
        return 0

async def get_local_artist_playcount(user_id, artist_name):
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 AND LOWER(t.artist_name)=LOWER($2)", str(user_id), artist_name)
            return row['count'] if row else 0
    except Exception: return 0

async def get_local_track_playcount(user_id, artist_name, track_name):
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 AND LOWER(t.artist_name)=LOWER($2) AND LOWER(t.track_name)=LOWER($3)", str(user_id), artist_name, track_name)
            return row['count'] if row else 0
    except Exception: return 0

async def get_local_album_playcount(user_id, artist_name, album_name):
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 AND LOWER(t.artist_name)=LOWER($2) AND LOWER(t.album_name)=LOWER($3)", str(user_id), artist_name, album_name)
            return row['count'] if row else 0
    except Exception: return 0

async def db_fetch(query, *args):
    """Run a query on the pool and return records, or [] if no pool."""
    if not db_pool: return []
    try:
        async with db_pool.acquire() as conn:
            return await conn.fetch(query, *args)
    except Exception as e:
        print(f"{Log.RED}>>> DB error: {e}{Log.RESET}")
        return []
async def get_local_top_artists(user_id, limit=10, api_period='overall', before_dt=None):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["l.user_id=$1"]
    args = [str(user_id)]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        tz = await get_user_timezone(user_id)
        year = int(api_period)
        args.append(float(year))
        query_parts.append(f"EXTRACT(YEAR FROM l.played_at AT TIME ZONE 'UTC' AT TIME ZONE '{tz}') = ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"l.played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return {r['artist_name']: r['plays'] for r in rows}

async def get_local_top_albums(user_id, limit=10, api_period='overall', before_dt=None):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["l.user_id=$1", "t.album_name IS NOT NULL AND t.album_name != ''"]
    args = [str(user_id)]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        tz = await get_user_timezone(user_id)
        year = int(api_period)
        args.append(float(year))
        query_parts.append(f"EXTRACT(YEAR FROM l.played_at AT TIME ZONE 'UTC' AT TIME ZONE '{tz}') = ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"l.played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.album_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.album_name, t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['album_name'], r['artist_name'], r['plays']) for r in rows]
async def get_local_top_tracks(user_id, limit=10, api_period='overall', before_dt=None):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["l.user_id=$1"]
    args = [str(user_id)]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        year = int(api_period)
        args.append(datetime(year, 1, 1))
        query_parts.append(f"l.played_at >= ${len(args)}")
        args.append(datetime(year + 1, 1, 1))
        query_parts.append(f"l.played_at < ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"l.played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.track_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.track_name, t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['track_name'], r['artist_name'], r['plays']) for r in rows]

async def get_local_artist_top_tracks(user_id, artist_name, limit=10, api_period='overall', before_dt=None):
    from datetime import datetime, timedelta
    from .config import PERIOD_TO_DAYS
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["l.user_id=$1", "LOWER(t.artist_name)=LOWER($2)"]
    args = [str(user_id), artist_name]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        tz = await get_user_timezone(user_id)
        year = int(api_period)
        args.append(float(year))
        query_parts.append(f"EXTRACT(YEAR FROM l.played_at AT TIME ZONE 'UTC' AT TIME ZONE '{tz}') = ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"l.played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.track_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.track_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['track_name'], r['plays']) for r in rows]

async def get_server_top_artists(member_ids, limit=10, api_period='overall'):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["user_id = ANY($1)"]
    args = [member_ids]
    
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['artist_name'], r['plays']) for r in rows]

async def get_server_top_albums(member_ids, limit=10, api_period='overall'):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["user_id = ANY($1)", "t.album_name IS NOT NULL AND t.album_name != ''"]
    args = [member_ids]
    
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.album_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.album_name, t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['album_name'], r['artist_name'], r['plays']) for r in rows]

async def get_server_top_tracks(member_ids, limit=10, api_period='overall'):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["user_id = ANY($1)"]
    args = [member_ids]
    
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"l.played_at >= ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT t.track_name, t.artist_name, COUNT(*) as plays FROM listens l JOIN tracks t ON l.track_id = t.id WHERE {where_clause} GROUP BY t.track_name, t.artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['track_name'], r['artist_name'], r['plays']) for r in rows]

async def get_global_whoknows(artist_name: str, limit: int = 15):
    rows = await db_fetch("""
        SELECT user_id, COUNT(*) as plays 
        FROM listens l JOIN tracks t ON l.track_id = t.id 
        WHERE LOWER(t.artist_name) = LOWER($1) 
        GROUP BY user_id 
        ORDER BY plays DESC 
        LIMIT $2
    """, artist_name, limit)
    return [(r['user_id'], r['plays']) for r in rows]

async def get_global_whoknows_track(artist_name: str, track_name: str, limit: int = 15):
    rows = await db_fetch("""
        SELECT user_id, COUNT(*) as plays 
        FROM listens l JOIN tracks t ON l.track_id = t.id 
        WHERE LOWER(t.artist_name) = LOWER($1) AND LOWER(t.track_name) = LOWER($2)
        GROUP BY user_id 
        ORDER BY plays DESC 
        LIMIT $3
    """, artist_name, track_name, limit)
    return [(r['user_id'], r['plays']) for r in rows]

async def get_global_whoknows_album(artist_name: str, album_name: str, limit: int = 15):
    rows = await db_fetch("""
        SELECT user_id, COUNT(*) as plays 
        FROM listens l JOIN tracks t ON l.track_id = t.id 
        WHERE LOWER(t.artist_name) = LOWER($1) AND LOWER(t.album_name) = LOWER($2)
        GROUP BY user_id 
        ORDER BY plays DESC 
        LIMIT $3
    """, artist_name, album_name, limit)
    return [(r['user_id'], r['plays']) for r in rows]

async def get_local_total_plays(user_id):
    rows = await db_fetch("SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1", str(user_id))
    return rows[0]['total'] if rows else 0
async def get_local_plays_before(user_id, before_dt):
    rows = await db_fetch("SELECT COUNT(*) as total FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 AND played_at < $2", str(user_id), before_dt)
    return rows[0]['total'] if rows else 0
async def get_local_recent_tracks(user_id, limit=10):
    rows = await db_fetch(
        "SELECT t.track_name, t.artist_name, l.played_at FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 ORDER BY l.played_at DESC LIMIT $2",
        str(user_id), limit
    )
    return [(r['track_name'], r['artist_name'], r['played_at']) for r in rows]

async def get_global_update_version():
    if not db_pool: 
        from src.core.config import CURRENT_UPDATE_VERSION
        return CURRENT_UPDATE_VERSION
    async with db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'current_update_version'")
            if row and row['value']:
                return row['value']
        except Exception as e:
            print(f"{Log.RED}>>> Error fetching global update version: {e}{Log.RESET}")
        from src.core.config import CURRENT_UPDATE_VERSION
        return CURRENT_UPDATE_VERSION

async def get_global_update_message():
    if not db_pool: 
        from src.core.config import CURRENT_UPDATE_MESSAGE
        return CURRENT_UPDATE_MESSAGE
    async with db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'current_update_message'")
            if row and row['value']:
                return row['value']
        except Exception as e:
            print(f"{Log.RED}>>> Error fetching global update message: {e}{Log.RESET}")
        from src.core.config import CURRENT_UPDATE_MESSAGE
        return CURRENT_UPDATE_MESSAGE

async def get_user_spotify_refresh_token(user_id):
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT spotify_refresh_token FROM user_settings WHERE user_id=$1", str(user_id))
            return row['spotify_refresh_token'] if row else None
    except Exception:
        return None

async def set_user_spotify_refresh_token(user_id, token):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, spotify_refresh_token) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET spotify_refresh_token = $2
            """, str(user_id), token)
    except Exception as e:
        print(f"{Log.RED}>>> Error setting spotify_refresh_token: {e}{Log.RESET}")

async def unlink_user(user_id):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("UPDATE user_settings SET lastfm_username = NULL WHERE user_id=$1", str(user_id))
            invalidate_user_cache(user_id)
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error unlinking user {user_id}: {e}{Log.RESET}")
        return False

async def clear_user_spotify(user_id):
    """Disconnect Spotify: drop all stored tokens. Returns True on success."""
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            try:
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_access_token TEXT")
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT")
                await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMP")
            except Exception:
                pass
            await conn.execute(
                "UPDATE user_settings SET spotify_access_token = NULL,"
                " spotify_refresh_token = NULL, spotify_token_expires_at = NULL"
                " WHERE user_id=$1", str(user_id))
            invalidate_user_cache(user_id)
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error clearing Spotify for {user_id}: {e}{Log.RESET}")
        return False

# --- FRIENDS & DMs ---

async def get_user_by_name(username):
    if not db_pool: return None
    import re
    
    # Check if the username is actually a mention or a raw ID
    mention_match = re.match(r'^<@!?(\d+)>$', username.strip())
    if mention_match:
        return mention_match.group(1)
        
    if username.strip().isdigit():
        return username.strip()

    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id FROM imported_users WHERE LOWER(username) = LOWER($1) OR LOWER(username) = LOWER($2)", str(username), str(username).replace('@', ''))
            if row: return row['id']
            # Fallback to display name
            row = await conn.fetchrow("SELECT user_id FROM user_settings WHERE LOWER(display_name) = LOWER($1) OR LOWER(display_name) = LOWER($2)", str(username), str(username).replace('@', ''))
            if row: return row['user_id']
            return None
    except Exception as e:
        print(f"{Log.RED}>>> Error getting user by name: {e}{Log.RESET}")
        return None

async def add_friend_request(user_id, friend_id, friend_username=None, user_username=None, friend_avatar=None, user_avatar=None):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            # Auto-insert into imported_users to satisfy FK constraints for users who haven't logged in
            if friend_username:
                await conn.execute("INSERT INTO imported_users (id, username, avatar_url) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url WHERE imported_users.avatar_url IS NULL", str(friend_id), str(friend_username), friend_avatar)
            if user_username:
                await conn.execute("INSERT INTO imported_users (id, username, avatar_url) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url WHERE imported_users.avatar_url IS NULL", str(user_id), str(user_username), user_avatar)
                
            # Check if request already exists in opposite direction
            existing = await conn.fetchrow("SELECT status FROM friends WHERE user_id=$1 AND friend_id=$2", str(friend_id), str(user_id))
            if existing:
                if existing['status'] == 'pending':
                    # Accept it automatically if they requested each other
                    await conn.execute("UPDATE friends SET status='accepted' WHERE user_id=$1 AND friend_id=$2", str(friend_id), str(user_id))
                    await conn.execute("INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'", str(user_id), str(friend_id))
                    return 'accepted'
                return 'already_friends'
            
            await conn.execute("INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING", str(user_id), str(friend_id))
            return 'pending'
    except Exception as e:
        print(f"{Log.RED}>>> Error adding friend request: {e}{Log.RESET}")
        return False

async def accept_friend_request(user_id, friend_id, friend_username=None, user_username=None, friend_avatar=None, user_avatar=None):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            # Auto-insert into imported_users to satisfy FK constraints for users who haven't logged in
            if friend_username:
                await conn.execute("INSERT INTO imported_users (id, username, avatar_url) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url WHERE imported_users.avatar_url IS NULL", str(friend_id), str(friend_username), friend_avatar)
            if user_username:
                await conn.execute("INSERT INTO imported_users (id, username, avatar_url) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url WHERE imported_users.avatar_url IS NULL", str(user_id), str(user_username), user_avatar)
                
            await conn.execute("UPDATE friends SET status='accepted' WHERE user_id=$1 AND friend_id=$2", str(friend_id), str(user_id))
            await conn.execute("INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'", str(user_id), str(friend_id))
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error accepting friend request: {e}{Log.RESET}")
        return False

async def remove_friend(user_id, friend_id):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)", str(user_id), str(friend_id))
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error removing friend: {e}{Log.RESET}")
        return False

async def get_friends(user_id):
    if not db_pool: return []
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT friend_id, status FROM friends WHERE user_id=$1", str(user_id))
            
            # Also get pending requests sent to this user
            incoming_rows = await conn.fetch("SELECT user_id as friend_id, status FROM friends WHERE friend_id=$1 AND status='pending'", str(user_id))
            
            friends_list = []
            for row in rows:
                friends_list.append({'id': row['friend_id'], 'status': row['status'], 'direction': 'outgoing' if row['status'] == 'pending' else 'mutual'})
            for row in incoming_rows:
                friends_list.append({'id': row['friend_id'], 'status': row['status'], 'direction': 'incoming'})
                
            return friends_list
    except Exception as e:
        print(f"{Log.RED}>>> Error getting friends: {e}{Log.RESET}")
        return []

async def send_dm(sender_id, receiver_id, content):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)", str(sender_id), str(receiver_id), content)
            return True
    except Exception as e:
        print(f"{Log.RED}>>> Error sending DM: {e}{Log.RESET}")
        return False

async def get_global_setting(key: str):
    if not db_pool: return None
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = $1", key)
            return row['value'] if row else None
    except Exception as e:
        print(f"{Log.RED}>>> Error getting global setting {key}: {e}{Log.RESET}")
        return None

async def set_global_setting(key: str, value: str):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("INSERT INTO global_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", key, str(value))
    except Exception as e:
        print(f"{Log.RED}>>> Error setting global setting {key}: {e}{Log.RESET}")

async def get_streak(user_id: str, artist: str, track: str = None, album: str = None):
    """
    Calculate the current uninterrupted streak for a specific entity.
    """
    if not db_pool: return 0
    
    # We will get the most recent listens ordered by time descending.
    # We will count how many consecutive rows match the entity.
    # To optimize, we fetch in chunks so we don't load 100,000 rows if the streak is only 3.
    
    try:
        async with db_pool.acquire() as conn:
            streak = 0
            offset = 0
            chunk_size = 50
            
            while True:
                rows = await conn.fetch(f"SELECT t.artist_name, t.track_name, t.album_name FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id=$1 ORDER BY l.played_at DESC LIMIT {chunk_size} OFFSET {offset}", str(user_id))
                
                if not rows:
                    break
                    
                for row in rows:
                    r_artist = row['artist_name'].lower() if row['artist_name'] else ""
                    r_track = row['track_name'].lower() if row['track_name'] else ""
                    r_album = row['album_name'].lower() if row['album_name'] else ""
                    
                    if track:
                        if r_artist == artist.lower() and r_track == track.lower():
                            streak += 1
                        else:
                            return streak
                    elif album:
                        if r_artist == artist.lower() and r_album == album.lower():
                            streak += 1
                        else:
                            return streak
                    else:
                        if r_artist == artist.lower():
                            streak += 1
                        else:
                            return streak
                            
                offset += chunk_size
                
            return streak
    except Exception as e:
        print(f"{Log.RED}>>> Error getting streak: {e}{Log.RESET}")
        return 0


async def get_streak_history(user_id: str, min_plays: int = 25):
    """
    Get streak history for a user using a gaps and islands query.
    Returns a list of dicts with keys: artist_name, streak_length, started_at, ended_at
    """
    if not db_pool: return []
    try:
        async with db_pool.acquire() as conn:
            res = await conn.fetch(f'''
                WITH numbered_listens AS (
                    SELECT 
                        l.user_id,
                        t.artist_name,
                        l.played_at,
                        ROW_NUMBER() OVER(PARTITION BY l.user_id ORDER BY l.played_at) as rn,
                        ROW_NUMBER() OVER(PARTITION BY l.user_id, t.artist_name ORDER BY l.played_at) as artist_rn
                    FROM listens l
                    JOIN tracks t ON l.track_id = t.id
                    WHERE l.user_id = $1
                ),
                grouped_streaks AS (
                    SELECT 
                        artist_name,
                        COUNT(*) as streak_length,
                        MIN(played_at) as started_at,
                        MAX(played_at) as ended_at
                    FROM numbered_listens
                    GROUP BY user_id, artist_name, (rn - artist_rn)
                )
                SELECT * FROM grouped_streaks 
                WHERE streak_length >= $2 
                ORDER BY ended_at DESC;
            ''', str(user_id), min_plays)
            return [dict(r) for r in res]
    except Exception as e:
        print(f"{Log.RED}>>> Error getting streak history: {e}{Log.RESET}")
        return []

async def is_command_disabled(command_name: str) -> str:
    rows = await db_fetch("SELECT reason FROM disabled_commands WHERE command_name = $1", command_name)
    if rows:
        return rows[0]['reason']
    return None

