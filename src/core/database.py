import json
import os
import asyncpg
from datetime import datetime, timedelta
from .config import POSTGRES_URL, DATABASE_URL, USERS_FILE, Log, PERIOD_TO_DAYS

db_pool = None

async def init_db():
    global db_pool
    db_conn_string = POSTGRES_URL or DATABASE_URL
    if db_conn_string:
        try:
            db_pool = await asyncpg.create_pool(db_conn_string)
            print(f"{Log.GREEN}>>> Database pool created successfully{Log.RESET}")
            async with db_pool.acquire() as conn:
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS user_settings (
                        user_id TEXT PRIMARY KEY,
                        fm_mode TEXT,
                        show_features BOOLEAN DEFAULT FALSE,
                        data_source TEXT DEFAULT 'combined'
                    )
                ''')
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.YELLOW}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r") as f:
            try:
                return json.load(f)
            except:
                return {}
    return {}

def save_user(uid, username):
    users = load_users()
    users[str(uid)] = username
    with open(USERS_FILE, "w") as f:
        json.dump(users, f)

def get_lastfm_username(uid):
    return load_users().get(str(uid))

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