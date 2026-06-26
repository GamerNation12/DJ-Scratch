import json
import os
import asyncpg
from datetime import datetime, timedelta
from .config import POSTGRES_URL, DATABASE_URL, Log, PERIOD_TO_DAYS

display_name_cache = {}
name_cache_task = None

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
        print(f"Error updating name cache: {e}")
        
    if name_cache_task is None:
        import asyncio
        name_cache_task = asyncio.create_task(_poll_name_cache())

def format_name(user):
    if not user: return "Unknown"
    
    uid = getattr(user, 'id', None)
    if uid and str(uid) in display_name_cache:
        return display_name_cache[str(uid)]
        
    name = getattr(user, 'name', str(user))
    if name == "gamernation12":
        return "GamerNation12"
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
                max_size=3,
                max_inactive_connection_lifetime=30.0
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
                        timezone TEXT DEFAULT 'UTC'
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
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN timezone TEXT DEFAULT 'UTC'")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN lastfm_username TEXT")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN show_track_playcount BOOLEAN DEFAULT TRUE")
                except Exception:
                    pass
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN display_name TEXT")
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
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.YELLOW}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
    
    await init_name_cache()



async def get_user_fm_mode(user_id):
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
        print(f"Error setting fm_mode: {e}")

async def get_user_show_features(user_id):
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
        print(f"Error setting show_features: {e}")

async def get_user_show_track_playcount(user_id):
    if not db_pool: return True
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT show_track_playcount FROM user_settings WHERE user_id=$1", str(user_id))
            return row['show_track_playcount'] if row and row['show_track_playcount'] is not None else True
    except Exception:
        return True

async def set_user_show_track_playcount(user_id, show_track_playcount: bool):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, show_track_playcount) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET show_track_playcount = $2
            """, str(user_id), show_track_playcount)
    except Exception as e:
        print(f"Error setting show_track_playcount: {e}")

async def get_user_data_source(user_id):
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
        print(f"Error setting data_source: {e}")

async def get_user_timezone(user_id):
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
    if not db_pool: return
    async with db_pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO user_settings (user_id, update_notifs) VALUES ($1, $2) "
                "ON CONFLICT (user_id) DO UPDATE SET update_notifs = EXCLUDED.update_notifs",
                str(uid), enabled
            )
        except Exception as e:
            print(f"Failed to set_user_update_notifs: {e}")

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
    if not db_pool: return
    async with db_pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO user_settings (user_id, last_update_seen) VALUES ($1, $2) "
                "ON CONFLICT (user_id) DO UPDATE SET last_update_seen = EXCLUDED.last_update_seen",
                str(uid), version
            )
        except Exception as e:
            print(f"Failed to set_user_last_update_seen: {e}")

async def set_user_timezone(user_id, tz):
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, timezone) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET timezone = $2
            """, str(user_id), tz)
    except Exception as e:
        print(f"Error setting timezone: {e}")

async def get_local_total_plays(user_id):
    if not db_pool: return 0
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) FROM listens WHERE user_id=$1", str(user_id))
            return row['count'] if row else 0
    except Exception:
        return 0

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
    
    query_parts = ["user_id=$1"]
    args = [str(user_id)]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        tz = await get_user_timezone(user_id)
        year = int(api_period)
        args.append(float(year))
        query_parts.append(f"EXTRACT(YEAR FROM played_at AT TIME ZONE 'UTC' AT TIME ZONE '{tz}') = ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT artist_name, COUNT(*) as plays FROM listens WHERE {where_clause} GROUP BY artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return {r['artist_name']: r['plays'] for r in rows}
async def get_local_top_tracks(user_id, limit=10, api_period='overall', before_dt=None):
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["user_id=$1"]
    args = [str(user_id)]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        year = int(api_period)
        args.append(datetime(year, 1, 1))
        query_parts.append(f"played_at >= ${len(args)}")
        args.append(datetime(year + 1, 1, 1))
        query_parts.append(f"played_at < ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT track_name, artist_name, COUNT(*) as plays FROM listens WHERE {where_clause} GROUP BY track_name, artist_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['track_name'], r['artist_name'], r['plays']) for r in rows]

async def get_local_artist_top_tracks(user_id, artist_name, limit=10, api_period='overall', before_dt=None):
    from datetime import datetime, timedelta
    from .config import PERIOD_TO_DAYS
    days = PERIOD_TO_DAYS.get(api_period)
    
    query_parts = ["user_id=$1", "LOWER(artist_name)=LOWER($2)"]
    args = [str(user_id), artist_name]
    
    if api_period and str(api_period).isdigit() and len(str(api_period)) == 4:
        tz = await get_user_timezone(user_id)
        year = int(api_period)
        args.append(float(year))
        query_parts.append(f"EXTRACT(YEAR FROM played_at AT TIME ZONE 'UTC' AT TIME ZONE '{tz}') = ${len(args)}")
    elif days:
        since = datetime.utcnow() - timedelta(days=days)
        args.append(since)
        query_parts.append(f"played_at >= ${len(args)}")
        
    if before_dt:
        args.append(before_dt)
        query_parts.append(f"played_at < ${len(args)}")
        
    where_clause = " AND ".join(query_parts)
    args.append(limit)
    
    rows = await db_fetch(
        f"SELECT track_name, COUNT(*) as plays FROM listens WHERE {where_clause} GROUP BY track_name ORDER BY plays DESC LIMIT ${len(args)}",
        *args
    )
    return [(r['track_name'], r['plays']) for r in rows]

async def get_local_total_plays(user_id):
    rows = await db_fetch("SELECT COUNT(*) as total FROM listens WHERE user_id=$1", str(user_id))
    return rows[0]['total'] if rows else 0
async def get_local_plays_before(user_id, before_dt):
    rows = await db_fetch("SELECT COUNT(*) as total FROM listens WHERE user_id=$1 AND played_at < $2", str(user_id), before_dt)
    return rows[0]['total'] if rows else 0
async def get_local_recent_tracks(user_id, limit=10):
    rows = await db_fetch(
        "SELECT track_name, artist_name, played_at FROM listens WHERE user_id=$1 ORDER BY played_at DESC LIMIT $2",
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
            print(f"Error fetching global update version: {e}")
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
            print(f"Error fetching global update message: {e}")
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
        print(f"Error setting spotify_refresh_token: {e}")

async def unlink_user(user_id):
    if not db_pool: return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("UPDATE user_settings SET lastfm_username = NULL WHERE user_id=$1", str(user_id))
            return True
    except Exception as e:
        print(f"Error unlinking user {user_id}: {e}")
        return False