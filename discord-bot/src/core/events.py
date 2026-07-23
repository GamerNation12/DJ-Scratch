from src.core.config import Log
import os
import discord
import aiohttp
import json
import asyncio
import urllib.parse
from discord.ext import commands, tasks
from discord import app_commands
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import asyncpg
import uuid
from ..utils.api import *

FM_TRACK_CACHE = {}

# --- TERMINAL COLOR CODES ---
class Log:
    RESET = '\033[0m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'

# --- BOT SETUP ---
load_dotenv()
intents = discord.Intents.default()
intents.message_content = True  
intents.presences = True  
intents.members = True    

class CustomTree(app_commands.CommandTree):
    def __init__(self, client):
        super().__init__(
            client, 
            allowed_installs=app_commands.AppInstallationType(guild=True, user=True), 
            allowed_contexts=app_commands.AppCommandContext(guild=True, dm_channel=True, private_channel=True)
        )

bot = commands.Bot(command_prefix=",", intents=intents, tree_cls=CustomTree)
bot.is_restarting = False
bot.remove_command('help')

async def add_restarting_user(user_id, channel_id):
    from src.core.database import db_pool
    import json
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'restart_notifs'")
            users = []
            if row and row['value']:
                try:
                    users = json.loads(row['value'])
                except:
                    pass
            
            entry = {"user_id": user_id, "channel_id": channel_id}
            if entry not in users:
                users.append(entry)
                await conn.execute(
                    "INSERT INTO global_settings (key, value) VALUES ('restart_notifs', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    json.dumps(users)
                )
    except Exception as e:
        print(f"Failed to save restart notif for {user_id}: {e}")

async def update_user_activity(user_id):
    from src.core.database import db_pool
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_settings (user_id, last_active, purge_warning_sent) 
                VALUES ($1, CURRENT_TIMESTAMP, FALSE)
                ON CONFLICT (user_id) 
                DO UPDATE SET last_active = CURRENT_TIMESTAMP, purge_warning_sent = FALSE
            """, str(user_id))
    except Exception as e:
        pass

async def run_inactive_purge():
    from src.core.database import db_pool
    from datetime import datetime, timedelta, timezone
    if not db_pool:
        return
        
    try:
        async with db_pool.acquire() as conn:
            warning_cutoff = datetime.now(timezone.utc) - timedelta(days=53)
            to_warn = await conn.fetch(
                "SELECT user_id FROM user_settings WHERE last_active <= $1 AND purge_warning_sent = FALSE",
                warning_cutoff
            )
            for row in to_warn:
                uid = row['user_id']
                try:
                    user = await bot.fetch_user(int(uid))
                    if user:
                        await user.send("⚠️ **Account Inactivity Warning**\nYour DJ Scratch data hasn't been used in over 50 days. It will be permanently deleted in 7 days due to inactivity.\n\n*To cancel this deletion, simply run any command like `/fm` or `/stats`!*")
                except Exception:
                    pass
                await conn.execute("UPDATE user_settings SET purge_warning_sent = TRUE WHERE user_id = $1", uid)
                
            delete_cutoff = datetime.now(timezone.utc) - timedelta(days=60)
            to_delete = await conn.fetch(
                "SELECT user_id FROM user_settings WHERE last_active <= $1",
                delete_cutoff
            )
            for row in to_delete:
                uid = row['user_id']
                await conn.execute("DELETE FROM user_settings WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM command_permissions WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM friends WHERE user_id = $1 OR friend_id = $1", uid)
                await conn.execute("DELETE FROM website_logs WHERE user_id = $1", uid)
                await conn.execute("DELETE FROM direct_messages WHERE sender_id = $1 OR receiver_id = $1", uid)
                
            if to_delete:
                print(f"Purged {len(to_delete)} inactive users.")
    except Exception as e:
        print(f"Error in run_inactive_purge: {e}")

@bot.tree.interaction_check
async def check_restarting_slash(interaction: discord.Interaction) -> bool:
    asyncio.create_task(update_user_activity(interaction.user.id))
    if getattr(bot, 'is_restarting', False):
        try:
            timestamp = int(bot.is_restarting) if isinstance(bot.is_restarting, float) else int(time.time() + 60)
            reason = getattr(bot, 'restart_reason', 'Maintenance')
            await interaction.channel.send(f"⚠️ {interaction.user.mention}, **Warning:** The bot is restarting <t:{timestamp}:R> because: **{reason}**. Your command might be interrupted! (We will ping you here when it's back online)", delete_after=15)
        except:
            pass
        await add_restarting_user(interaction.user.id, interaction.channel.id)
    return True

@bot.check
async def check_restarting_prefix(ctx) -> bool:
    asyncio.create_task(update_user_activity(ctx.author.id))
    if getattr(bot, 'is_restarting', False):
        try:
            timestamp = int(bot.is_restarting) if isinstance(bot.is_restarting, float) else int(time.time() + 60)
            reason = getattr(bot, 'restart_reason', 'Maintenance')
            await ctx.send(f"⚠️ {ctx.author.mention}, **Warning:** The bot is restarting <t:{timestamp}:R> because: **{reason}**. Your command might be interrupted! (We will ping you here when it's back online)", delete_after=15)
        except:
            pass
        await add_restarting_user(ctx.author.id, ctx.channel.id)
    return True


# === LAST.FM CONFIG ===
LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "eee299142ac5fe73e5eb5dcd1c29bcae")
OWNER_ID = 759433582107426816

COOLDOWN_FILE = "avatar_cooldown.txt"
from src.core.theme import Theme
LASTFM_COLOR = Theme.PRIMARY 
avatar_cooldown_time = None

PERIOD_MAP = {
    '7d': ('7day', 'Last 7 Days'), '7day': ('7day', 'Last 7 Days'),
    '1m': ('1month', 'Last Month'), '1month': ('1month', 'Last Month'),
    '3m': ('3month', 'Last 3 Months'), '3month': ('3month', 'Last 3 Months'),
    '6m': ('6month', 'Last 6 Months'), '6month': ('6month', 'Last 6 Months'),
    '1y': ('12month', 'Last Year'), '12m': ('12month', 'Last Year'), '12month': ('12month', 'Last Year'),
    'all': ('overall', 'All Time'), 'overall': ('overall', 'All Time'),
    'at': ('overall', 'All Time')
}

def get_period_data(input_period):
    if not input_period: return 'overall', 'All Time'
    input_lower = input_period.lower()
    if input_lower.isdigit() and len(input_lower) == 4:
        return input_lower, f"Year {input_lower}"
    return PERIOD_MAP.get(input_lower, ('overall', 'All Time'))

def get_medal(index):
    return f"` {index+1}. `"

# --- SUGGESTION VIEW & MODAL ---
class SuggestionFeedbackModal(discord.ui.Modal, title="Admin Feedback"):
    feedback = discord.ui.TextInput(
        label="Feedback Message",
        style=discord.TextStyle.long,
        placeholder="Type your reply to the user here... (Optional)",
        required=False
    )

    def __init__(self, action_status: str, action_color: discord.Color, action_emoji: str, db_status: str, is_bug: bool = False):
        super().__init__()
        self.action_status = action_status
        self.action_color = action_color
        self.action_emoji = action_emoji
        self.db_status = db_status
        self.is_bug = is_bug

    async def on_submit(self, interaction: discord.Interaction):
        embed = interaction.message.embeds[0]
        try:
            suggester_id = int(embed.author.name.split('(')[-1].strip(')'))
        except:
            suggester_id = None
            
        feedback_text = self.feedback.value

        # Update Database
        global db_pool
        if db_pool and suggester_id:
            import asyncpg
            if isinstance(db_pool, asyncpg.pool.Pool):
                async with db_pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE suggestions SET status = $1, admin_feedback = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND description = $4",
                        self.db_status, feedback_text, str(suggester_id), embed.description
                    )

        # Update Message
        embed.color = self.action_color
        embed.add_field(name="Status", value=f"{self.action_emoji} **{self.action_status}**", inline=False)
        if feedback_text:
            embed.add_field(name="Your Reply", value=feedback_text, inline=False)
            
        view = discord.ui.View() # Empty view removes buttons
        await interaction.response.edit_message(embed=embed, view=view)

        # DM User
        if suggester_id:
            try:
                suggester = await interaction.client.fetch_user(suggester_id)
                item_type = "bug report" if self.is_bug else "suggestion"
                desc_lines = [f"Your {item_type} has been marked as **{self.action_status.upper()}**.", f"", f"**Your Report:**" if self.is_bug else f"**Your Idea:**", embed.description]
                title = f"{self.action_emoji} Bug Report Update" if self.is_bug else f"{self.action_emoji} Suggestion Update"
                notify_embed = Theme.get_embed(title=title, description=chr(10).join(desc_lines), color=self.action_color)
                if feedback_text:
                    notify_embed.add_field(name="Developer Reply", value=feedback_text, inline=False)
                notify_embed.set_footer(text="DJ Scratch Feedback System")
                await suggester.send(embed=notify_embed)
                print(f"Notified user about {item_type}: {self.action_status}")
            except:
                pass
        try:
            log_title = "Bug Report Updated (Admin)" if self.is_bug else "Suggestion Updated (Admin)"
            log_embed = Theme.get_embed(title=log_title, description=embed.description, color=self.action_color, timestamp=datetime.now())
            log_embed.add_field(name="Status", value=f"{self.action_emoji} **{self.action_status}**", inline=False)
            if feedback_text:
                log_embed.add_field(name="Reply", value=feedback_text, inline=False)
            log_embed.set_footer(text=f"User ID: {suggester_id or 'Unknown'}")
            await log_to_channel("website-log", log_embed)
        except: pass

class SuggestionView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Approve", style=discord.ButtonStyle.success, custom_id="sugg_approve")
    async def approve_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Approved", discord.Color.green(), "🟢", "approved"))

    @discord.ui.button(label="Deny", style=discord.ButtonStyle.danger, custom_id="sugg_deny")
    async def deny_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Denied", discord.Color.red(), "🔴", "denied"))
        
    @discord.ui.button(label="Released", style=discord.ButtonStyle.primary, custom_id="sugg_released")
    async def released_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Update Released", discord.Color.blurple(), "🚀", "completed"))

class BugReportView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Fixed", style=discord.ButtonStyle.success, custom_id="bug_fixed")
    async def fixed_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Fixed", discord.Color.green(), "🛠️", "completed", is_bug=True))

    @discord.ui.button(label="Not a Bug", style=discord.ButtonStyle.danger, custom_id="bug_not_a_bug")
    async def not_a_bug_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Not a Bug", discord.Color.red(), "❌", "denied", is_bug=True))
        
    @discord.ui.button(label="Investigating", style=discord.ButtonStyle.primary, custom_id="bug_investigating")
    async def investigating_btn(self, i: discord.Interaction, b: discord.ui.Button):
        await i.response.send_modal(SuggestionFeedbackModal("Investigating", discord.Color.blurple(), "🔍", "approved", is_bug=True))

async def setup_hook():
    bot.session = aiohttp.ClientSession()
    bot.add_view(SuggestionView())
    bot.add_view(BugReportView())
    try:
        from src.commands.settings import SettingsView
        bot.add_view(SettingsView())
    except Exception as e:
        print("Failed to add SettingsView:", e)
    global db_pool
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if db_url:
        try:
            if "pooler.supabase.com" in db_url and ":5432" in db_url:
                db_url = db_url.replace(":5432", ":6543")
            db_pool = await asyncpg.create_pool(dsn=db_url, ssl="require", min_size=1, max_size=3, statement_cache_size=0)
            
            import src.core.database as db_module
            db_module.db_pool = db_pool
            await db_module.init_name_cache()
            
            print(f"{Log.GREEN}>>> Connected to Postgres DB{Log.RESET}")
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_settings (
                        user_id VARCHAR(255) PRIMARY KEY,
                        fm_mode VARCHAR(50) DEFAULT 'full'
                    )
                    """
                )
                try:
                    await conn.execute("ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id)")
                except Exception:
                    pass
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS website_logs (
                        id SERIAL PRIMARY KEY,
                        user_id TEXT,
                        username TEXT,
                        action TEXT,
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_features BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'combined'")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS private_mode BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lastfm_username TEXT")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_track_playcount BOOLEAN DEFAULT TRUE")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS update_notifs BOOLEAN DEFAULT TRUE")
                except Exception as e:
                    pass
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_update_seen TEXT DEFAULT ''")
                except Exception as e:
                    pass

                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT")
                except Exception as e:
                    pass

                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
                except Exception as e:
                    pass

                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS purge_warning_sent BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    pass
                    
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS global_settings (
                        key VARCHAR(255) PRIMARY KEY,
                        value TEXT
                    )
                    """
                )
                
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS suggestions (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        username VARCHAR(255) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT NOT NULL,
                        status VARCHAR(50) DEFAULT 'pending',
                        admin_feedback TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS bot_actions (
                        id SERIAL PRIMARY KEY,
                        action_type VARCHAR(50) NOT NULL,
                        status VARCHAR(20) DEFAULT 'PENDING',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS command_usage (
                        command_name VARCHAR(100) PRIMARY KEY,
                        usage_count INT DEFAULT 0
                    )
                    """
                )
                
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lastfm_username VARCHAR(255)")
                except Exception as e:
                    print(f"{Log.RED}>>> Failed to add lastfm_username column: {e}{Log.RESET}")
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC'")
                except Exception as e:
                    print(f"{Log.RED}>>> Failed to add timezone column: {e}{Log.RESET}")

                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_track_playcount BOOLEAN DEFAULT TRUE")
                except Exception as e:
                    print(f"{Log.RED}>>> Failed to add show_track_playcount column: {e}{Log.RESET}")

                # One-time migration
                if os.path.exists("lastfm_users.json"):
                    try:
                        with open("lastfm_users.json", "r") as f:
                            old_users = json.load(f)
                        for uid, uname in old_users.items():
                            await conn.execute(
                                "INSERT INTO user_settings (user_id, lastfm_username) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username",
                                str(uid), uname
                            )
                        os.rename("lastfm_users.json", "lastfm_users.json.bak")
                        print(f"{Log.GREEN}>>> Migrated lastfm_users.json to Postgres!{Log.RESET}")
                    except Exception as e:
                        print(f"{Log.RED}>>> Failed to migrate JSON: {e}{Log.RESET}")

                print(f"{Log.GREEN}>>> Ensured user_settings table exists{Log.RESET}")
            bot.get_avatar_cooldown = get_avatar_cooldown
            bot.get_user_fm_mode = get_user_fm_mode
            bot.process_fm = process_fm
            bot.process_top_artists = process_top_artists
            bot.process_top_tracks = process_top_tracks
            bot.process_artist_tracks = process_artist_tracks
            bot.process_recent = process_recent
            bot.process_judge = process_judge
            bot.process_receipt = process_receipt
            bot.process_profile = process_profile
            bot.process_whoknows = process_whoknows
            bot.process_suggestion = process_suggestion
            bot.get_help_embed = get_help_embed
            bot.process_crowns = process_crowns
            bot.handle_discord_import = handle_discord_import
            bot.PurgeConfirmView = PurgeConfirmView
            bot.add_custom_reactions = add_custom_reactions
            bot.save_user = save_user

            cogs = ['cogs.admin', 'src.commands.admin_ipc', 'src.commands.lastfm', 'src.commands.importer', 'src.commands.settings', 'src.commands.info', 'src.commands.spotify_remote', 'src.commands.social', 'src.commands.status']
            for cog in cogs:
                try:
                    await bot.load_extension(cog)
                    print(f"{Log.GREEN}>>> Loaded {cog}{Log.RESET}")
                except Exception as e:
                    print(f"{Log.RED}>>> Failed to load {cog}: {e}{Log.RESET}")
            
            from src.core.socket_server import start_socket_server
            await start_socket_server()
            
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.RED}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
bot.setup_hook = setup_hook

db_pool = None







import discord
import json
import ijson
import zipfile
import io
import uuid
import csv
from datetime import datetime
from .database import *
def parse_apple_music_csv(file_obj, user):
    import re
    reader = csv.DictReader(file_obj)
    for row in reader:
        artist = row.get("Container Artist Name") or row.get("Artist Name")
        title = row.get("Song Name")
        album = row.get("Album Name") or ""
        played_at_raw = row.get("Event Start Timestamp")
        play_dur = row.get("Play Duration Milliseconds")
        media_dur = row.get("Media Duration In Milliseconds")
        
        if not artist or not title or not played_at_raw:
            continue

        album = re.sub(r'(?i)\s*-\s*EP$', '', album)
        album = re.sub(r'(?i)\s*-\s*Single$', '', album)
        album = album.strip()
            
        ms_played = 0
        try:
            if play_dur:
                ms_played = int(play_dur)
                if ms_played < 30000:
                    continue
                if media_dur and ms_played <= 240000:
                    media_len = int(media_dur)
                    if ms_played <= (media_len / 2):
                        continue
        except:
            pass
            
        try:
            cleaned_time = played_at_raw.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned_time)
            end_dt = dt + timedelta(milliseconds=ms_played)
            yield (str(user.id), artist, title, album, end_dt, ms_played)
        except Exception as e:
            continue

def stream_parse_spotify_json(file_obj):
    import ijson
    try:
        for track in ijson.items(file_obj, 'item'):
            yield track
    except Exception as e:
        print(f"Error parsing JSON stream: {e}")
def parse_single_spotify_track(user, track):
    import re
    artist = track.get("master_metadata_album_artist_name")
    title = track.get("master_metadata_track_name")
    album = track.get("master_metadata_album_album_name") or ""
    played_at_raw = track.get("ts")
    ms_played = track.get("ms_played") or 0
    spotify_uri = track.get("spotify_track_uri")

    if not artist or not title or not played_at_raw or ms_played < 30000:
        return None

    album = re.sub(r'(?i)\s*-\s*EP$', '', album)
    album = re.sub(r'(?i)\s*-\s*Single$', '', album)
    album = album.strip()

    try:
        cleaned_time = played_at_raw.replace("Z", "+00:00")
        if " " in cleaned_time and "T" not in cleaned_time:
            parts = cleaned_time.split(":")
            if len(parts) == 2:
                cleaned_time = cleaned_time + ":00"
        try:
            dt = datetime.fromisoformat(cleaned_time)
        except:
            try:
                dt = datetime.strptime(cleaned_time, "%Y-%m-%d %H:%M:%S")
            except:
                dt = datetime.strptime(cleaned_time, "%Y-%m-%d %H:%M")
        return (str(user.id), artist, title, album, dt, ms_played, spotify_uri)
    except:
        return None
async def insert_tracks_in_db(valid_tracks):
    if not valid_tracks:
        return 0

    valid_tracks.sort(key=lambda x: x[4])
    
    filtered_tracks = []
    last_end = None
    
    for t in valid_tracks:
        user_id, artist, title, album, end_dt, ms_played, spotify_uri = t
        start_dt = end_dt - timedelta(milliseconds=ms_played)
        
        if last_end is None or start_dt >= (last_end - timedelta(seconds=15)):
            filtered_tracks.append((user_id, artist, title, album, end_dt, ms_played, spotify_uri))
            last_end = end_dt
        else:
            pass
            
    if not filtered_tracks:
        return 0

    chunk_size = 1000
    inserted_count = 0
    for i in range(0, len(filtered_tracks), chunk_size):
        chunk = filtered_tracks[i:i + chunk_size]
        try:
            async with db_pool.acquire() as conn:
                await conn.executemany(
                    """
                    INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at, ms_played, spotify_uri)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
                    """,
                    chunk
                )
                inserted_count += len(chunk)
                print(f"    [IMPORT PROGRESS] Inserted chunk... ({inserted_count} valid non-overlapping tracks so far)")
        except Exception as e:
            print(f"{Log.RED}>>> Error inserting database chunk: {e}{Log.RESET}")
    return inserted_count
async def process_discord_import_in_background(user, temp_filepath, is_zip, response_target):
    import zipfile
    import os
    import gc
    import io

    processed_count = 0
    try:
        # Ensure user exists in imported_users table
        try:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO imported_users (id, username)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
                    """,
                    str(user.id), format_name(user)
                )
        except Exception as e:
            print(f"{Log.RED}>>> Error ensuring imported_user: {e}{Log.RESET}")



        all_valid_tracks = []
        
        async def flush_tracks():
            nonlocal processed_count
            if all_valid_tracks:
                processed_count += await insert_tracks_in_db(all_valid_tracks)
                all_valid_tracks.clear()
                gc.collect()
        # Parse and process
        if not is_zip:
            if temp_filepath.lower().endswith(".csv"):
                with open(temp_filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for idx, parsed in enumerate(parse_apple_music_csv(f, user)):
                            all_valid_tracks.append(parsed)
                            if len(all_valid_tracks) >= 25000:
                                await flush_tracks()
                            if idx % 1000 == 0:
                                await asyncio.sleep(0)
            else:
                # Process single JSON file from disk using our zero-RAM streaming parser
                with open(temp_filepath, "rb") as f:
                    for idx, track in enumerate(stream_parse_spotify_json(f)):
                        parsed = parse_single_spotify_track(user, track)
                        if parsed:
                            all_valid_tracks.append(parsed)
                        if len(all_valid_tracks) >= 25000:
                            await flush_tracks()
                        if idx % 1000 == 0:
                            await asyncio.sleep(0)
        else:
            # Process ZIP file entry by entry from disk using our zero-RAM streaming parser
            with zipfile.ZipFile(temp_filepath) as z:
                # fmbot logic: Reject Account Data packages which contain Userdata and lack album names
                if any("userdata" in name.lower() for name in z.namelist()):
                    try:
                        os.remove(temp_filepath)
                    except: pass
                    
                    embed = Theme.get_embed(
                        title="❌ Invalid Export Package",
                        description="You uploaded the **Account Data** package, which is missing album names and contains duplicates.\\n\\nPlease go to Spotify Privacy settings and request the **Extended streaming history** instead.",
                        color=discord.Color.red(),
                        timestamp=datetime.now()
                    )
                    await user.send(embed=embed)
                    return

                if any(name.endswith("Apple Music Play Activity.csv") for name in z.namelist()):
                    for filename in z.namelist():
                        if filename.endswith("Apple Music Play Activity.csv"):
                            with z.open(filename) as f:
                                text_stream = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
                                for idx, parsed in enumerate(parse_apple_music_csv(text_stream, user)):
                                    all_valid_tracks.append(parsed)
                                    if len(all_valid_tracks) >= 25000:
                                        await flush_tracks()
                                    if idx % 1000 == 0:
                                        await asyncio.sleep(0)
                elif any(name.endswith("Apple_Media_Services.zip") for name in z.namelist()):
                    inner_zip_name = next(name for name in z.namelist() if name.endswith("Apple_Media_Services.zip"))
                    with z.open(inner_zip_name) as inner_f:
                        with zipfile.ZipFile(io.BytesIO(inner_f.read())) as inner_z:
                            for filename in inner_z.namelist():
                                if filename.endswith("Apple Music Play Activity.csv"):
                                    with inner_z.open(filename) as f:
                                        text_stream = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
                                        for idx, parsed in enumerate(parse_apple_music_csv(text_stream, user)):
                                            all_valid_tracks.append(parsed)
                                            if len(all_valid_tracks) >= 25000:
                                                await flush_tracks()
                                            if idx % 1000 == 0:
                                                await asyncio.sleep(0)
                else:
                    for filename in z.namelist():
                        if filename.endswith(".json") and any(x in filename for x in ["StreamingHistory", "endsong", "Streaming_History"]):
                            try:
                                with z.open(filename) as f:
                                    for idx, track in enumerate(stream_parse_spotify_json(f)):
                                        parsed = parse_single_spotify_track(user, track)
                                        if parsed:
                                            all_valid_tracks.append(parsed)
                                        if len(all_valid_tracks) >= 25000:
                                            await flush_tracks()
                                        if idx % 1000 == 0:
                                            await asyncio.sleep(0)
                            except Exception as e:
                                print(f"{Log.RED}>>> Error processing {filename} inside zip: {e}{Log.RESET}")

        await flush_tracks()

        # Delete temp file
        try:
            os.remove(temp_filepath)
        except: pass

        # Send DM when finished
        embed = Theme.get_embed(
            title="✅ Spotify Import Complete!",
            description=(
                f"Hey **{format_name(user)}**, your Spotify history has finished importing!\n\n"
                f"• **{processed_count:,}** tracks processed successfully.\n\n"
                f"You can now use bot commands like `/profile` or `/topartists`!"
            ),
            color=0x2ecc71,
            timestamp=datetime.now()
        )
        await user.send(embed=embed)

    except Exception as e:
        print(f"{Log.RED}>>> Error in background import process: {e}{Log.RESET}")
        try:
            os.remove(temp_filepath)
        except: pass
        try:
            await user.send(f"❌ An error occurred during the background import of your Spotify data: {e}")
        except: pass
async def handle_discord_import(user, attachment, response_target):
    try:
        is_zip = attachment.filename.endswith(".zip")
        ext = 'zip' if is_zip else ('csv' if attachment.filename.endswith('.csv') else 'json')
        temp_filepath = f"temp_import_{user.id}_{attachment.id}.{ext}"
        
        # Save attachment directly to disk in streamed mode
        await attachment.save(temp_filepath)
        
        # Add to import queue instead of processing immediately
        await import_queue.put((user, temp_filepath, is_zip, response_target))
        queue_pos = import_queue.qsize()
        
        await response_target(f"✅ File received successfully! You are currently position **#{queue_pos}** in the import queue. The bot will process your history in the background and DM you when finished.")
    except Exception as e:
        print(f"{Log.RED}>>> Error in handle_discord_import saving file: {e}{Log.RESET}")
        await response_target("❌ An error occurred while receiving your file.")
async def handle_discord_import_link(user, link, response_target):
    try:
        is_zip = link.lower().endswith(".zip") or "zip" in link.lower()
        ext = 'zip' if is_zip else ('csv' if '.csv' in link.lower() else 'json')
        temp_filepath = f"temp_import_{user.id}_link.{ext}"
        
        await response_target("⏳ Downloading file from link... (This may take a moment for large files)")
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(link) as resp:
                if resp.status != 200:
                    await response_target("❌ Failed to download from the provided link. Please ensure it is a direct download link.")
                    return
                with open(temp_filepath, 'wb') as f:
                    while True:
                        chunk = await resp.content.read(65536)
                        if not chunk: break
                        f.write(chunk)
        
        await import_queue.put((user, temp_filepath, is_zip, response_target))
        queue_pos = import_queue.qsize()
        
        await response_target(f"✅ Link downloaded successfully! You are currently position **#{queue_pos}** in the import queue. The bot will DM you when finished.")
        
    except Exception as e:
        print(f"{Log.RED}>>> Error in handle_discord_import_link: {e}{Log.RESET}")
        await response_target("❌ An error occurred while downloading or processing the link.")
import_queue = asyncio.Queue()

async def import_worker():
    while True:
        user, temp_filepath, is_zip, response_target = await import_queue.get()
        print(f"{Log.CYAN}>>> [IMPORT QUEUE] Starting import for {format_name(user)} ({user.id}). Items left in queue: {import_queue.qsize()}{Log.RESET}")
        
        try:
            log_channel = bot.get_channel(1517288950522187947)
            if log_channel:
                await log_channel.send(f"📥 **{format_name(user)}** (`{user.id}`) data is currently importing. Items left in queue: **{import_queue.qsize()}**")
        except Exception as e:
            pass

        try:
            await process_discord_import_in_background(user, temp_filepath, is_zip, response_target)
        except Exception as e:
            print(f"{Log.CYAN}>>> [IMPORT QUEUE] Error processing import for {format_name(user)}: {e}{Log.RESET}")
            try:
                log_channel = bot.get_channel(1517288950522187947)
                if log_channel:
                    await log_channel.send(f"❌ Error importing data for **{format_name(user)}** (`{user.id}`): {e}")
            except Exception:
                pass
        finally:
            import_queue.task_done()
            print(f"{Log.CYAN}>>> [IMPORT QUEUE] Finished import task for {format_name(user)}.{Log.RESET}")
            
            try:
                log_channel = bot.get_channel(1517288950522187947)
                if log_channel:
                    await log_channel.send(f"✅ Finished import task for **{format_name(user)}** (`{user.id}`).")
            except Exception:
                pass

async def web_import_worker():
    import tempfile
    import os
    import asyncio
    from .database import db_pool
    
    while True:
        try:
            if db_pool:
                async with db_pool.acquire() as conn:
                    records = await conn.fetch("SELECT * FROM import_jobs WHERE status = 'ready' ORDER BY created_at ASC")
                    for record in records:
                        job_id = record['id']
                        user_id_str = record['user_id']
                        filename = record['filename']
                        
                        await conn.execute("UPDATE import_jobs SET status = 'processing' WHERE id = $1", job_id)
                        
                        user = bot.get_user(int(user_id_str))
                        if user:
                            try:
                                await user.send(f"📥 Your web dashboard upload `{filename}` has been received! You've been added to the import queue.")
                            except: pass
                        
                        temp_dir = tempfile.gettempdir()
                        temp_filepath = os.path.join(temp_dir, f"web_import_{job_id}_{filename}")
                        
                        chunks = await conn.fetch("SELECT data FROM import_chunks WHERE job_id = $1 ORDER BY chunk_index ASC", job_id)
                        with open(temp_filepath, 'wb') as f:
                            for chunk in chunks:
                                f.write(chunk['data'])
                        
                        await conn.execute("DELETE FROM import_chunks WHERE job_id = $1", job_id)
                        await conn.execute("UPDATE import_jobs SET status = 'completed' WHERE id = $1", job_id)
                        
                        is_zip = filename.lower().endswith(".zip")
                        if user:
                            await import_queue.put((user, temp_filepath, is_zip, None))
                        else:
                            os.remove(temp_filepath)
                            
        except Exception as e:
            print(f"{Log.RED}>>> Error in web_import_worker: {e}{Log.RESET}")
            
        await asyncio.sleep(10)


async def spotify_track_length_scanner():
    """Background task to sync track lengths from Spotify API and delete invalid scrobbles."""
    from .database import db_pool
    from src.utils.spotify import fetch_spotify_track_durations
    total_processed = 0
    was_processing = False
    while True:
        try:
            if db_pool: # Dummy comment to trigger webhook
                async with db_pool.acquire() as conn:
                    # Fetch up to 1000 unique tracks to process
                    rows = await conn.fetch("SELECT ctid, spotify_uri, ms_played FROM listens WHERE spotify_uri IS NOT NULL AND spotify_uri NOT LIKE 'VALID_%' LIMIT 1000")
                    if rows:
                        was_processing = True
                        uris = [row['spotify_uri'] for row in rows]
                        
                        # Split URIs into chunks of 50 for Spotify API
                        chunks = [uris[i:i + 50] for i in range(0, len(uris), 50)]
                        
                        # Fetch all chunks concurrently
                        tasks = [fetch_spotify_track_durations(chunk) for chunk in chunks]
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        
                        # Merge durations
                        durations = {}
                        api_failed = False
                        for res in results:
                            if res is None or isinstance(res, Exception):
                                api_failed = True
                                break
                            if isinstance(res, dict):
                                durations.update(res)
                                
                        if api_failed:
                            print(f"{Log.RED}>>> [BACKGROUND SCANNER] Spotify API requires Premium! Scanner is permanently paused until bot is restarted.{Log.RESET}")
                            break
                        
                        delete_ctids = []
                        update_ctids = []
                        
                        for row in rows:
                            uri = row['spotify_uri']
                            ctid = row['ctid']
                            ms_played = row['ms_played']
                            
                            duration_ms = durations.get(uri)
                            if duration_ms:
                                # Apply 50% rule or 4 minutes
                                if ms_played < duration_ms / 2 and ms_played < 240000:
                                    delete_ctids.append(ctid)
                                else:
                                    update_ctids.append(ctid)
                            else:
                                # Not found on Spotify, mark as valid to skip future checks
                                update_ctids.append(ctid)
                                
                        if delete_ctids:
                            await conn.execute("DELETE FROM listens WHERE ctid = ANY($1::tid[])", delete_ctids)
                        if update_ctids:
                            await conn.execute("UPDATE listens SET spotify_uri = 'VALID_' || spotify_uri WHERE ctid = ANY($1::tid[])", update_ctids)
                            
                        # Log progress to console
                        total_processed += len(rows)
                        print(f"{Log.CYAN}>>> [BACKGROUND SCANNER] Processed {len(rows)} tracks. Total processed this session: {total_processed}{Log.RESET}")
                        
                        await asyncio.sleep(0.1)
                    else:
                        if was_processing:
                            print(f"{Log.GREEN}>>> [BACKGROUND SCANNER] Queue completely empty! All tracks have been validated and filtered.{Log.RESET}")
                            was_processing = False
                        await asyncio.sleep(60)
            else:
                await asyncio.sleep(60)
        except Exception as e:
            print(f"{Log.RED}>>> Error in spotify_track_length_scanner: {e}{Log.RESET}")
            await asyncio.sleep(60)

@bot.event
async def on_ready():
    print(r"""
========================================================================
  _____ _             ____             _          ____     _ 
 |_   _| |__   ___   / ___| ___   __ _| |_ ___   |  _ \   | |
   | | | '_ \ / _ \ | |  _ / _ \ / _` | __/ __|  | | | |  | |
   | | | | | |  __/ | |_| | (_) | (_| | |_\__ \  | |_| |  | |
   |_| |_| |_|\___|  \____|\___/ \__,_|\__|___/  |____/  _/ |
                                                        |__/ 
========================================================================""")
    print(f"{Log.GREEN}[OK] ONLINE AS: {bot.user}{Log.RESET}")
    total_servers = len(bot.guilds)
    total_members = sum(g.member_count for g in bot.guilds if g.member_count)
    print(f"{Log.GREEN}[OK] CONNECTED TO: {total_servers} servers | {total_members} members{Log.RESET}")
    print(f"{Log.GREEN}[OK] SYNCED COMMANDS: {len(bot.tree.get_commands())} global commands{Log.RESET}")
    print(f"{Log.YELLOW}! NOTE: Slash commands do not auto-sync. Run ',sync' in Discord if needed.{Log.RESET}")
    


    from .database import db_pool
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'bot_status'")
                if row and row['value']:
                    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.listening, name=row['value']))
                    print(f"{Log.GREEN}>>> Restored bot status to: {row['value']}{Log.RESET}")
        except Exception as e:
            print(f"{Log.RED}>>> Failed to load bot status from DB: {e}{Log.RESET}")

    bot.loop.create_task(import_worker())
    bot.loop.create_task(web_import_worker())
    bot.loop.create_task(spotify_track_length_scanner())
@bot.event
async def on_guild_join(guild):
    print(f"JOINED GUILD: {guild.name} ({guild.id}) - {guild.member_count} members")
    
    try:
        target_channel = guild.system_channel
        if not target_channel or not target_channel.permissions_for(guild.me).send_messages:
            for channel in guild.text_channels:
                if channel.permissions_for(guild.me).send_messages:
                    target_channel = channel
                    break
                    
        if target_channel:
            info_cog = bot.get_cog("InfoCog")
            if info_cog:
                await info_cog.send_guide(target_channel)
    except Exception as e:
        print(f"Failed to send guide in {guild.name}: {e}")
        
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = Theme.get_embed(
            title="📥 Joined New Server!",
            description=f"**Name:** {guild.name}\n**ID:** `{guild.id}`\n**Members:** {guild.member_count}\n**Owner:** {guild.owner if guild.owner else 'Unknown'}",
            color=discord.Color.green()
        )
        if guild.icon: embed.set_thumbnail(url=guild.icon.url)
        await owner.send(embed=embed)
        await log_to_channel("guild-join", embed)
    except Exception as e: print(f"{Log.RED}>>> Failed to notify owner of guild join: {e}{Log.RESET}")

@bot.event
async def on_guild_remove(guild):
    print(f"LEFT GUILD: {guild.name} ({guild.id})")
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = Theme.get_embed(
            title="📤 Left Server",
            description=f"**Name:** {guild.name}\n**ID:** `{guild.id}`",
            color=discord.Color.red()
        )
        if guild.icon: embed.set_thumbnail(url=guild.icon.url)
        await owner.send(embed=embed)
        await log_to_channel("guild-leave", embed)
    except Exception as e: print(f"{Log.RED}>>> Failed to notify owner of guild leave: {e}{Log.RESET}")

# --- HELPER: LOG TO CHANNEL ---
async def log_to_channel(channel_name: str, embed: discord.Embed):
    try:
        await bot.wait_until_ready()
        
        # Hardcoded specific log channels from owner
        channel_ids = {
            "guild-join": 1527127384535334954,
            "guild-leave": 1527127384535334955,
            "errors": 1527127384535334956
        }
        
        if channel_name in channel_ids:
            channel = bot.get_channel(channel_ids[channel_name])
            if channel:
                await channel.send(embed=embed)
                return

        # Fallback to older string search behavior (e.g. for website-log)
        target_guild_id = os.getenv("LOG_GUILD_ID")
        
        for guild in bot.guilds:
            if target_guild_id and str(guild.id) != target_guild_id:
                continue
            if not target_guild_id and str(guild.id) != "1360772594122358834":
                continue
                
            channel = discord.utils.get(guild.text_channels, name=channel_name)
            if channel:
                await channel.send(embed=embed)
                return
    except Exception as e:
        print(f"{Log.RED}>>> Failed to log to {channel_name}: {e}{Log.RESET}")

# --- HELPER: ERROR DM ---
async def notify_owner(ctx, err):
    print(f"ERROR in {ctx}: {err}")
    try:
        await bot.wait_until_ready()
        owner = await bot.fetch_user(OWNER_ID)
        tick = chr(96)
        code_block = tick + tick + tick
        msg_lines = [f"An error occurred in **{str(ctx)}**:", f"{code_block}py", str(err)[:1800], code_block]
        embed = Theme.get_embed(title="⚠️ Bot Error", description=chr(10).join(msg_lines), color=discord.Color.red())
        embed.timestamp = datetime.now()
        await owner.send(embed=embed)
        await log_to_channel("errors", embed)
    except Exception as e: print(f"FAILED to notify owner: {e}")

@bot.event
async def on_command(ctx):
    location = f"Server: {ctx.guild.name} | Channel: #{ctx.channel.name}" if ctx.guild else "DM"
    print(f"{Log.CYAN}>>> [PREFIX COMMAND] {ctx.author} ran '{ctx.message.content}' in {location}{Log.RESET}")
    
    from .database import db_pool
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO user_settings (user_id, discord_username, display_name) 
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id) DO UPDATE SET 
                        discord_username = EXCLUDED.discord_username,
                        display_name = EXCLUDED.display_name
                """, str(ctx.author.id), ctx.author.name, ctx.author.display_name)
        except Exception:
            pass

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound): return
    if isinstance(error, commands.CheckFailure): return
    
    # Handle common user-facing errors
    usage = f"`{ctx.prefix}{ctx.command.name} {ctx.command.signature}`" if ctx.command else ""
    
    if isinstance(error, commands.MissingRequiredArgument):
        return await ctx.send(f"⚠️ You're missing a required piece of information: `{error.param.name}`.\n**The right way to use this is:** {usage}")
    elif isinstance(error, commands.CommandOnCooldown):
        return await ctx.send(f"⏳ Whoa there, slow down! You can use this command again in **{error.retry_after:.1f} seconds**.")
    elif isinstance(error, commands.BadArgument):
        return await ctx.send(f"⚠️ I couldn't understand one of your inputs. Please make sure you're typing it correctly!\n**The right way to use this is:** {usage}")
    elif isinstance(error, commands.MissingPermissions):
        return await ctx.send("🚫 You don't have the required permissions to use this command.")
    elif isinstance(error, commands.BotMissingPermissions):
        return await ctx.send("🚫 I don't have the required permissions to perform this action here.")
    elif isinstance(error, commands.MemberNotFound):
        return await ctx.send(f"⚠️ I couldn't find that user. Make sure you typed their name correctly.\n**The right way to use this is:** {usage}")
        
    await notify_owner(f"{ctx.prefix}{ctx.invoked_with}", error)
    try: await ctx.send("Whoops! Something went wrong behind the scenes. The developer has been notified. If you need help, join our support server: https://discord.gg/53sxaVWn92")
    except: pass

@bot.tree.error
async def on_app_command_error_tree(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    if isinstance(error, discord.app_commands.CheckFailure): return
    
    msg = None
    if isinstance(error, discord.app_commands.CommandOnCooldown):
        msg = f"⏳ Whoa there, slow down! You can use this command again in **{error.retry_after:.1f} seconds**."
    elif isinstance(error, discord.app_commands.MissingPermissions):
        msg = "🚫 You don't have the required permissions to use this command."
    elif isinstance(error, discord.app_commands.BotMissingPermissions):
        msg = "🚫 I don't have the required permissions to perform this action here."
        
    if msg:
        if not interaction.response.is_done():
            try: await interaction.response.send_message(msg, ephemeral=True)
            except: pass
        else:
            try: await interaction.followup.send(msg, ephemeral=True)
            except: pass
        return

    cmd_name = interaction.command.name if interaction.command else "unknown"
    await notify_owner(f"/{cmd_name}", error)
    
    fallback_msg = "Whoops! Something went wrong behind the scenes. The developer has been notified. If you need help, join our support server: https://discord.gg/53sxaVWn92"
    if not interaction.response.is_done(): 
        try: await interaction.response.send_message(fallback_msg, ephemeral=True)
        except: pass
    else:
        try: await interaction.followup.send(fallback_msg, ephemeral=True)
        except: pass

@bot.tree.interaction_check
async def check_if_banned(interaction: discord.Interaction) -> bool:
    from .database import db_pool
    if not db_pool: return True
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT is_banned, ban_reason FROM user_settings WHERE user_id=$1",
                str(interaction.user.id)
            )
            if row and row.get('is_banned'):
                reason = row.get('ban_reason') or "No reason provided."
                try:
                    await interaction.response.send_message(
                        f"❌ **You are banned from using DJ Scratch.**\n\n**Reason:** {reason}\n*If you believe this is a mistake, please contact GamerNation12.*",
                        ephemeral=True
                    )
                except:
                    pass
                return False
    except Exception as e:
        print(f"{Log.RED}>>> Error checking ban status: {e}{Log.RESET}")
    return True

@bot.check
async def global_ban_check_prefix(ctx) -> bool:
    from .database import db_pool
    if not db_pool: return True
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT is_banned, ban_reason FROM user_settings WHERE user_id=$1",
                str(ctx.author.id)
            )
            if row and row.get('is_banned'):
                reason = row.get('ban_reason') or "No reason provided."
                try:
                    await ctx.send(f"❌ **You are banned from using DJ Scratch.**\n\n**Reason:** {reason}\n*If you believe this is a mistake, please contact GamerNation12.*")
                except:
                    pass
                return False
    except Exception as e:
        print(f"{Log.RED}>>> Error checking ban status: {e}{Log.RESET}")
    return True

@bot.tree.interaction_check
async def check_if_logged_in(interaction: discord.Interaction) -> bool:
    if interaction.type != discord.InteractionType.application_command:
        return True
    
    if interaction.user.id == OWNER_ID:
        return True
    
    # Allow specific commands without login
    allowed_commands = ["login", "logout", "help", "suggest", "bug", "cd", "privacy", "ping", "status", "updates", "guide", "start", "tutorial", "howto"]
    if interaction.command and interaction.command.name in allowed_commands:
        return True
        
    username = await get_lastfm_username(interaction.user.id)
    if not username:
        embed = Theme.get_embed(
            title="⚠️ Account Not Linked",
            description="You need to log into the updated website to use this command!\n\n🔗 **[Login Here](https://dj-scratch.vercel.app/)** or use `/login` to link your Last.fm account.\n*Need help? Run `/guide` to learn how to start!*",
            color=discord.Color.red()
        )
        try:
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except:
            pass
        return False
    return True

@bot.check
async def global_login_check_prefix(ctx) -> bool:
    if ctx.author.id == OWNER_ID:
        return True
        
    allowed_commands = ["login", "logout", "help", "suggest", "bug", "cd", "cd2", "privacy", "ping", "status", "updates", "sync", "guide", "start", "tutorial", "howto"]
    if ctx.command and ctx.command.name in allowed_commands:
        return True
        
    username = await get_lastfm_username(ctx.author.id)
    if not username:
        embed = Theme.get_embed(
            title="⚠️ Account Not Linked",
            description="You need to log into the updated website to use this command!\n\n🔗 **[Login Here](https://dj-scratch.vercel.app/)** or use `,login` to link your Last.fm account.\n*Need help? Run `,guide` to learn how to start!*",
            color=discord.Color.red()
        )
        try:
            await ctx.send(embed=embed)
        except:
            pass
        return False
    return True

@bot.event
async def on_app_command_completion(interaction: discord.Interaction, command: discord.app_commands.Command | discord.app_commands.ContextMenu):
    location = f"Server: {interaction.guild.name} | Channel: #{interaction.channel.name}" if interaction.guild else "DM"
    print(f"{Log.CYAN}>>> [SLASH COMMAND] {interaction.user} ran '/{command.name}' in {location}{Log.RESET}")
    
    import time
    if not hasattr(bot, 'active_users_dict'):
        bot.active_users_dict = {}
    bot.active_users_dict[interaction.user.id] = time.time()
    
    global db_pool
    if not db_pool: return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO command_usage (command_name, usage_count)
                VALUES ($1, 1)
                ON CONFLICT (command_name) DO UPDATE SET usage_count = command_usage.usage_count + 1
                """,
                command.name
            )
    except Exception as e:
        print(f"{Log.RED}>>> Failed to track command usage: {e}{Log.RESET}")

# --- HELPER: AVATAR COOLDOWN ---
async def get_avatar_cooldown():
    global db_pool
    if not db_pool: return 0
    now = datetime.utcnow()
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'avatar_cooldown'")
        if row and row['value']:
            try:
                last_update = datetime.fromisoformat(row['value'])
                diff = (now - last_update).total_seconds()
                if diff < 300: return int(300 - diff)
            except: pass
    return 0


async def add_custom_reactions(message):
    try:
        await message.add_reaction("<a:mc_Fire:1423825520516141138>")
        await message.add_reaction("<a:Jamming:1441565477313970259>")
    except: pass

# --- HELPER: DATABASE MANAGEMENT ---
async def load_users():
    global db_pool
    if not db_pool: return {}
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, lastfm_username FROM user_settings WHERE lastfm_username IS NOT NULL")
        return {r['user_id']: r['lastfm_username'] for r in rows}

async def load_display_names():
    global db_pool
    if not db_pool: return {}
    async with db_pool.acquire() as conn:
        try:
            rows = await conn.fetch("SELECT user_id, display_name FROM user_settings WHERE display_name IS NOT NULL")
            return {r['user_id']: r['display_name'] for r in rows}
        except Exception:
            return {}

async def save_user(uid, username):
    global db_pool
    if not db_pool:
        print(f"No database connection available to save user!")
        return
    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO user_settings (user_id, lastfm_username) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username",
            str(uid), username
        )
    print(f"{Log.GREEN}>>> Saved Last.fm user to Postgres: {username} ({uid}){Log.RESET}")

async def get_lastfm_username(uid):
    if bot and bot.user and str(uid) == str(bot.user.id):
        return "DJ-Scratch"
        
    global db_pool
    if not db_pool: return None
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT lastfm_username FROM user_settings WHERE user_id = $1", str(uid))
        return row['lastfm_username'] if row and row['lastfm_username'] else None

# --- LAST.FM API FETCHERS ---


class FMDetailsView(discord.ui.View):
    def __init__(self, bot_instance, artist, img, is_p, cd, user, spotify_url, song, original_msg=None):
        super().__init__(timeout=None)
        self.bot_instance = bot_instance
        self.artist = artist
        self.img = img
        self.user = user
        self.song = song
        self.original_msg = original_msg
        
        if spotify_url:
            self.add_item(discord.ui.Button(label="Listen on Spotify", url=spotify_url, emoji="🎧", style=discord.ButtonStyle.link))
            
        if song and artist:
            custom_lyric = f"fm_lyrics:{artist[:40]}:{song[:40]}"
            btn_lyrics = discord.ui.Button(label="Lyrics", emoji="📝", style=discord.ButtonStyle.secondary, custom_id=custom_lyric)
            self.add_item(btn_lyrics)
            
        if is_p and img and cd <= 0:
            custom_prev = f"fm_preview:{artist[:80]}"
            btn2 = discord.ui.Button(label="Preview Avatar", emoji="🖼️", style=discord.ButtonStyle.primary, custom_id=custom_prev)
            self.add_item(btn2)

    async def show_lyrics(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        from src.core.lyrics import fetch_lyrics
        session = getattr(self.bot_instance, 'session', None)
        lyrics_data = await fetch_lyrics(session, self.artist, self.song)
        if lyrics_data and (lyrics_data.get("synced") or lyrics_data.get("plain")):
            from src.core.karaoke import KaraokeLyricsView
            
            # WORKAROUND: Check Spotify OAuth first!
            start_time = 0.0
            from src.utils.spotify import fetch_user_currently_playing
            spotify_progress = await fetch_user_currently_playing(str(interaction.user.id))
            
            if spotify_progress > 0:
                start_time = spotify_progress
            else:
                # Fallback: Check Discord Rich Presence
                if isinstance(interaction.user, discord.Member):
                    for activity in interaction.user.activities:
                        if isinstance(activity, discord.Spotify):
                            # Verify it's the same song by comparing artist or title
                            if self.artist.lower() in activity.artist.lower() or self.song.lower() in activity.title.lower():
                                import datetime
                                now = datetime.datetime.now(datetime.timezone.utc)
                                elapsed = (now - activity.start).total_seconds()
                                start_time = max(0.0, elapsed)
                                break
                            
            view = KaraokeLyricsView(self.artist, self.song, lyrics_data.get("synced"), lyrics_data.get("plain"), start_time=start_time)
            embed = view._build_embed()
            view.message = await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        else:
            await interaction.followup.send("Could not find lyrics for this track.", ephemeral=True)

    async def preview_avatar(self, interaction: discord.Interaction):
        preview_embed = Theme.get_embed(
            title="Bot Avatar Preview", 
            description=f"This is how the bot will look if you apply the album art for **{self.artist}**.", 
            color=LASTFM_COLOR
        )
        preview_embed.set_author(name=format_name(self.user), icon_url=self.img)
        preview_embed.set_image(url=self.img)
        
        apply_view = ApplyAvatarView(self.bot_instance, self.artist, self.img, original_msg=self.original_msg, original_user=self.user, track=self.song)
        await interaction.response.send_message(embed=preview_embed, view=apply_view, ephemeral=True)

class FMActionsView(discord.ui.View):
    def __init__(self, bot_instance, artist, img, is_p=False, cd=0, user=None, spotify_url=None, song=None, current_mode="full", track_data=None):
        super().__init__(timeout=None)
        self.bot_instance = bot_instance
        self.artist = artist
        self.img = img
        self.user = user
        self.song = song
        self.spotify_url = spotify_url
        self.is_p = is_p
        self.cd = cd
        self.current_mode = current_mode
        self.track_data = track_data
        
        user_id = str(user.id) if user else "None"
        
        unique_id = uuid.uuid4().hex[:8]
        if track_data is not None:
            FM_TRACK_CACHE[unique_id] = track_data
            if len(FM_TRACK_CACHE) > 1000:
                for k in list(FM_TRACK_CACHE.keys())[:100]:
                    FM_TRACK_CACHE.pop(k, None)
                    
        if current_mode == "compact":
            btn_down = discord.ui.Button(label="", emoji="<:Down:1528249702338789407>", style=discord.ButtonStyle.secondary, custom_id=f"fm_down:{user_id}:{current_mode}:{unique_id}")
            self.add_item(btn_down)
        elif current_mode == "full":
            btn_up = discord.ui.Button(label="", emoji="<:Up:1528249701164646410>", style=discord.ButtonStyle.secondary, custom_id=f"fm_up:{user_id}:{current_mode}:{unique_id}")
            self.add_item(btn_up)
            
            btn_down = discord.ui.Button(label="", emoji="<:Down:1528249702338789407>", style=discord.ButtonStyle.secondary, custom_id=f"fm_down:{user_id}:{current_mode}:{unique_id}")
            self.add_item(btn_down)
        elif current_mode == "stats":
            btn_up = discord.ui.Button(label="", emoji="<:Up:1528249701164646410>", style=discord.ButtonStyle.secondary, custom_id=f"fm_up:{user_id}:{current_mode}:{unique_id}")
            self.add_item(btn_up)
            
        if spotify_url and current_mode != "compact":
            self.add_item(discord.ui.Button(label="Listen on Spotify", url=spotify_url, emoji="🎧", style=discord.ButtonStyle.link))
            
        if song and artist and current_mode != "compact":
            custom_lyric = f"fm_lyrics:{artist[:40]}:{song[:40]}"
            btn_lyrics = discord.ui.Button(label="Lyrics", emoji="📝", style=discord.ButtonStyle.secondary, custom_id=custom_lyric)
            self.add_item(btn_lyrics)
            
        if is_p and img and cd <= 0 and current_mode != "compact":
            user_id_str = str(self.user.id) if self.user else "None"
            custom_prev = f"fm_preview:{user_id_str}:{unique_id}:{artist[:80]}"
            btn2 = discord.ui.Button(label="Preview Avatar", emoji="🖼️", style=discord.ButtonStyle.primary, custom_id=custom_prev)
            self.add_item(btn2)

    async def go_down(self, interaction: discord.Interaction):
        await interaction.response.defer()
        new_mode = "full" if self.current_mode == "compact" else "stats"
        result, _ = await process_fm(interaction, self.user, mode=new_mode, track_data=self.track_data)
        if result:
            content = result.get('content')
            if not interaction.response.is_done():
                await interaction.response.edit_message(content=content, embed=result.get('embed'), view=result.get('view'))
            else:
                await interaction.edit_original_response(content=content, embed=result.get('embed'), view=result.get('view'))

    async def go_up(self, interaction: discord.Interaction):
        await interaction.response.defer()
        new_mode = "full" if self.current_mode == "stats" else "compact"
        result, _ = await process_fm(interaction, self.user, mode=new_mode, track_data=self.track_data)
        if result:
            content = result.get('content')
            if not interaction.response.is_done():
                await interaction.response.edit_message(content=content, embed=result.get('embed'), view=result.get('view'))
            else:
                await interaction.edit_original_response(content=content, embed=result.get('embed'), view=result.get('view'))

    async def show_lyrics(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        from src.core.lyrics import fetch_lyrics
        session = getattr(self.bot_instance, 'session', None)
        lyrics = await fetch_lyrics(session, self.artist, self.song)
        if lyrics:
            if len(lyrics) > 4096:
                lyrics = lyrics[:4093] + "..."
            embed = Theme.get_embed(title=f"Lyrics for {self.song} by {self.artist}", description=lyrics, color=LASTFM_COLOR)
            await interaction.followup.send(embed=embed, ephemeral=True)
        else:
            await interaction.followup.send("Could not find lyrics for this track.", ephemeral=True)

    async def preview_avatar(self, interaction: discord.Interaction):
        preview_embed = Theme.get_embed(
            title="Bot Avatar Preview", 
            description=f"This is how the bot will look if you apply the album art for **{self.artist}**.", 
            color=LASTFM_COLOR
        )
        preview_embed.set_author(name=format_name(self.user), icon_url=self.img)
        preview_embed.set_image(url=self.img)
        
        apply_view = ApplyAvatarView(self.bot_instance, self.artist, self.img, original_msg=interaction.message, original_user=self.user, track=self.song)
        await interaction.response.send_message(embed=preview_embed, view=apply_view, ephemeral=True)

async def update_bot_avatar_and_status(bot_instance, artist, img, track=None, album=None):
    try:
        cd = await get_avatar_cooldown()
        if cd > 0:
            return False, cd

        async with bot_instance.session.get(img) as resp:
            if resp.status == 200:
                image_bytes = await resp.read()
                await bot_instance.user.edit(avatar=image_bytes)
                
                activity = discord.Activity(type=discord.ActivityType.listening, name=artist)
                await bot_instance.change_presence(activity=activity)
                
                from src.core.database import db_pool
                if db_pool:
                    now = datetime.utcnow()
                    async with db_pool.acquire() as conn:
                        await conn.execute("INSERT INTO global_settings (key, value) VALUES ('avatar_cooldown', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", now.isoformat())
                        await conn.execute("INSERT INTO global_settings (key, value) VALUES ('bot_status', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", artist)
                        if track:
                            await conn.execute("INSERT INTO global_settings (key, value) VALUES ('bot_track', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", track)
                        if album:
                            await conn.execute("INSERT INTO global_settings (key, value) VALUES ('bot_album', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", album)
                return True, 300
    except Exception as e:
        print(f"{Log.RED}>>> Error updating bot avatar: {e}{Log.RESET}")
    return False, 0

class ApplyAvatarView(discord.ui.View):
    def __init__(self, bot_instance, artist, img, original_msg=None, original_user=None, track=None, album=None, track_data=None):
        super().__init__(timeout=180)
        self.bot_instance = bot_instance
        self.artist = artist
        self.img = img
        self.original_msg = original_msg
        self.original_user = original_user
        self.track = track
        self.album = album
        self.track_data = track_data
        
    @discord.ui.button(label="Set as Bot Avatar", emoji="✅", style=discord.ButtonStyle.success)
    async def apply_avatar(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        changed, cd = await update_bot_avatar_and_status(self.bot_instance, self.artist, self.img, self.track, self.album)
        if changed:
            scr_res = False
            if self.track:
                from src.utils.api import scrobble_bot_track
                scr_res = await scrobble_bot_track(self.bot_instance.session, self.artist, self.track, self.album)
            
            debug_info = f"msg:{bool(self.original_msg)} usr:{bool(self.original_user)} scr:{scr_res}"
            await interaction.followup.send(f"✅ Avatar updated successfully! [{debug_info}]", ephemeral=True)
            self.stop()
            
            if self.original_msg and self.original_user:
                try:
                    await self.original_msg.delete()
                except Exception as e:
                    if interaction.guild:
                        await interaction.followup.send(f"⚠️ Could not delete old msg: {e}", ephemeral=True)
                
                try:
                    mode = await get_user_fm_mode(self.original_user.id)
                    result, is_p = await process_fm(interaction, self.original_user, mode=mode or "full", track_data=self.track_data)
                    
                    channel = self.original_msg.channel if self.original_msg else interaction.channel
                    if result and channel:
                        if isinstance(result, dict):
                            try:
                                new_msg = await interaction.followup.send(**result, ephemeral=False, wait=True)
                            except Exception:
                                new_msg = await channel.send(**result)
                            if is_p:
                                await add_custom_reactions(new_msg)
                        else:
                            await channel.send(result)
                    else:
                        if interaction.guild:
                            await interaction.followup.send(f"⚠️ Could not send new msg. Result: {bool(result)}, Channel: {bool(channel)}", ephemeral=True)
                except Exception as e:
                    if interaction.guild:
                        await interaction.followup.send(f"⚠️ Error resending fm: {e}", ephemeral=True)
        else:
            if cd > 0:
                m, s = divmod(cd, 60)
                await interaction.followup.send(f"⏳ Avatar is on cooldown. Please wait {m}m {s}s.", ephemeral=True)
            else:
                await interaction.followup.send("❌ Failed to update avatar. It might already be set.", ephemeral=True)

async def get_settings_embed(user_id, user):
    mode = await get_user_fm_mode(user_id)
    feats = await get_user_show_features(user_id)
    d_source = await get_user_data_source(user_id)
    embed = Theme.get_embed(title=f"⚙️ Settings for {format_name(user)}", color=LASTFM_COLOR)
    embed.add_field(name="/fm Display Mode", value=f"`{mode}`", inline=True)
    embed.add_field(name="Featured Artists", value=f"`{'ON' if feats else 'OFF'}`", inline=True)
    
    source_label = "Imported Only" if d_source == 'imported_only' else ("Last.fm Only" if d_source == 'lastfm_only' else "Last.fm + Imported")
    embed.add_field(name="Data Source", value=f"`{source_label}`", inline=True)
    
    embed.set_footer(text="Use the dropdown below to change your settings.")
    return embed

class SettingsDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Compact Text Mode", description="1-line plain text for /fm", emoji="📝", value="fm_compact"),
            discord.SelectOption(label="Full Embed Mode", description="Detailed embed for /fm", emoji="🖼️", value="fm_full"),
            discord.SelectOption(label="Stats View Mode", description="stats.fm style embed for /fm", emoji="📊", value="fm_stats"),
            discord.SelectOption(label="Enable Featured Artists", description="Show featured artists in /fm", emoji="🎤", value="feat_on"),
            discord.SelectOption(label="Disable Featured Artists", description="Hide featured artists in /fm", emoji="🚫", value="feat_off"),
            discord.SelectOption(label="Data: Combined", description="Use Last.fm + Imported Data", emoji="🔄", value="ds_combined"),
            discord.SelectOption(label="Data: Imported Only", description="Use strictly your Imported Data", emoji="📦", value="ds_imported_only"),
        ]
        super().__init__(placeholder="Select a setting to change...", min_values=1, max_values=1, options=options, custom_id="settings_dropdown")

    async def callback(self, interaction: discord.Interaction):
        val = self.values[0]
        if val.startswith("fm_"):
            mode = val.split("_")[1]
            await set_user_fm_mode(interaction.user.id, mode)
        elif val.startswith("feat_"):
            on = (val == "feat_on")
            await set_user_show_features(interaction.user.id, on)
        elif val.startswith("ds_"):
            source = val[3:]
            await set_user_data_source(interaction.user.id, source)
            
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self.view)

class SettingsView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(SettingsDropdown())

async def apply_features(session, artist, song, s_artists=None):
    import re
    m = re.search(r"[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\]\)]+)[\)\]]", song, flags=re.IGNORECASE)
    if m:
        features = m.group(1).strip()
        song = song.replace(m.group(0), "").strip()
        return f"{artist}, {features}", song
        
    if s_artists and len(s_artists) > 1:
        features = [a for a in s_artists if a.lower() not in artist.lower()]
        if features:
            return f"{artist}, {', '.join(features)}", song
    
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(artist + ' ' + song)}&entity=song&limit=5"
        async with session.get(url) as r:
            if r.status == 200:
                data = await r.json(content_type=None)
                if data.get('resultCount', 0) > 0:
                    for result in data['results']:
                        it_artist = result.get('artistName', '')
                        it_track = result.get('trackName', '')
                        
                        if 'remix' in it_track.lower() and 'remix' not in song.lower():
                            continue
                            
                        m2 = re.search(r"[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\]\)]+)[\)\]]", it_track, flags=re.IGNORECASE)
                        if m2:
                            features = m2.group(1).strip()
                            return f"{artist}, {features}", song
                        elif it_artist.lower() != artist.lower() and ('&' in it_artist or ',' in it_artist or 'feat' in it_artist.lower() or ' and ' in it_artist.lower() or ' x ' in it_artist.lower() or '/' in it_artist):
                            return it_artist, song
                        else:
                            return artist, song
    except Exception as e:
        pass
        
    return artist, song

# --- CORE LOGIC ---
import discord
from datetime import datetime, timedelta

from src.core.database import format_name




async def process_fm(ctx_int, user, mode="full", track_data=None):
    bot_instance = getattr(ctx_int, 'client', getattr(ctx_int, 'bot', bot))
    session = getattr(bot_instance, 'session', None)

    username = await get_lastfm_username(user.id)
    if not username: return {"embed": Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login`")}, False
    
    if track_data is not None:
        data = track_data
    else:
        data = await fetch_now_playing(username, 2)

    if isinstance(data, dict) and 'error' in data:
        err_msg = data.get('message', 'Unknown error')
        return {"embed": Theme.get_error_embed(description=f"Last.fm API Error: {err_msg}")}, False
        
    if not data or 'recenttracks' not in data or not data['recenttracks']['track']: 
        return {"embed": Theme.get_error_embed(description="Could not find recent tracks.")}, False
    
    try:
        tracks = data['recenttracks']['track']
        t = tracks[0]
        artist, song, album, img = t['artist']['#text'], t['name'], t['album']['#text'], t['image'][3]['#text']
        
        raw_artist, raw_song = artist, song

        # Run independent DB and API tasks concurrently
        async def get_spotify_data():
            from src.core.spotify import get_spotify_track_info, get_user_spotify_access_token
            u_token = await get_user_spotify_access_token(session, str(user.id))
            s_inf = await get_spotify_track_info(session, artist, song, user_token=u_token)
            if not s_inf and u_token:
                s_inf = await get_spotify_track_info(session, artist, song)
            return s_inf

        async def get_track_data(show_pc, m):
            if show_pc or m == "stats":
                return await fetch_track_info(username, raw_artist, raw_song)
            return None

        # Gather user preferences first
        from src.core.database import get_user_show_features, get_user_show_track_playcount
        show_features_task = asyncio.create_task(get_user_show_features(user.id))
        show_playcount_task = asyncio.create_task(get_user_show_track_playcount(user.id))
        
        show_features, show_playcount = await asyncio.gather(show_features_task, show_playcount_task)

        # Gather API data
        spotify_task = asyncio.create_task(get_spotify_data())
        track_info_task = asyncio.create_task(get_track_data(show_playcount, mode))

        s_info = await spotify_task
        t_info = await track_info_task

        spotify_url = None
        s_artists = None
        
        if s_info:
            spotify_url = s_info.get("spotify_url")
            s_img = s_info.get("image_url")
            if s_img and (not img or "2a96cbd8b46e442fc41c2b86b821562f" in img):
                img = s_img
            s_artists = s_info.get("artists")

        if not img or "2a96cbd8b46e442fc41c2b86b821562f" in img:
            try:
                from src.utils.api import fetch_deezer_track_image
                deezer_img = await fetch_deezer_track_image(session, song, artist)
                if deezer_img:
                    img = deezer_img
            except Exception as e:
                print(f"Deezer fallback error: {e}")

        if show_features:
            artist, song = await apply_features(session, artist, song, s_artists)
                
        track_url = t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(raw_artist)}/_/{urllib.parse.quote(raw_song)}")
        is_p = t.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_p else "Last Played"
        color = LASTFM_COLOR if is_p else discord.Color.dark_gray()

        if is_p:
            cd = await get_avatar_cooldown()
        else:
            cd = 0

        track_plays = -1
        if t_info and 'track' in t_info and 'userplaycount' in t_info['track']:
            track_plays = int(t_info['track']['userplaycount'])

        if mode == "compact":
            if is_p:
                content = f"<a:movingnotes:1476084305229910159> **{format_name(user)}** is listening to **[{song}](<{track_url}>)** by **{artist}**"
            else:
                content = f"🎧 **{format_name(user)}** was listening to **[{song}](<{track_url}>)** by **{artist}**"
                content += "\n*(⚠️ Scrobbles frozen? Run `,outofsync`)*"
            
            desc_lines = [f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"]
            if show_playcount and track_plays != -1:
                if track_plays == 0 and is_p:
                    desc_lines.append("\n🎧 **First time listening!**")
                else:
                    desc_lines.append(f"\n🔢 **{track_plays}** plays")
            
            desc = chr(10).join(desc_lines)
            embed = Theme.get_embed(description=desc, color=color)
            embed.set_author(name=f"{format_name(user)}'s {status}", icon_url=user.display_avatar.url)
            if img: embed.set_thumbnail(url=img)
            
            footer_text = f"Scrobbling as {'DJ Scratch' if username.lower() == 'dj-scratch' else username} | Scrobbles frozen? Run ,outofsync"
            if cd > 0:
                m, s = divmod(int(cd), 60)
                footer_text += f" • Avatar CD: {m}m {s}s"
                
            embed.set_footer(text=footer_text)
            
            view = FMActionsView(bot_instance, raw_artist, img, is_p=is_p, cd=cd, user=user, spotify_url=spotify_url, song=raw_song, current_mode="compact", track_data=data)
            return {"content": content, "view": view}, is_p

        if mode == "stats":
            desc_lines = [f"**[{song}]({track_url})**", f"**{artist}** • *{album}*"]
            
            if len(tracks) > 1:
                prev_t = tracks[1]
                p_artist, p_song, p_album = prev_t['artist']['#text'], prev_t['name'], prev_t['album']['#text']
                
                if show_features:
                    p_artist, p_song = await apply_features(session, p_artist, p_song)
                
                p_url = prev_t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(p_artist)}/_/{urllib.parse.quote(p_song)}")
                desc_lines.extend(["", "Previous:", f"**[{p_song}]({p_url})**", f"**{p_artist}** • *{p_album}*"])
            
            if show_playcount and track_plays != -1:
                if track_plays == 0 and is_p:
                    desc_lines.append("\n🎧 **First time listening!**")
                else:
                    desc_lines.append(f"\n🔢 **{track_plays}** plays")
            
            embed = Theme.get_embed(description=chr(10).join(desc_lines), color=color)
            embed.set_author(name=f"Now playing for {format_name(user)}" if is_p else f"Last played by {format_name(user)}")
            if img: embed.set_thumbnail(url=img)
            
            a_info_task = asyncio.create_task(fetch_artist_info(username, raw_artist))
            
            guild = getattr(ctx_int, 'guild', None)
            crown_task = None
            if guild:
                users_db = await load_users()
                display_names = await load_display_names()
                linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
                if linked:
                    async def fetch_crown():
                        tasks = [(uid, lname, fetch_artist_playcount(session, lname, raw_artist)) for uid, lname in linked.items()]
                        results = await asyncio.gather(*(t[2] for t in tasks))
                        
                        def get_name(uid, lname):
                            custom_name = display_names.get(uid)
                            if custom_name: return custom_name
                            member = guild.get_member(int(uid))
                            return member.display_name if member else lname
                            
                        lb = [{"name": get_name(tasks[i][0], tasks[i][1]), "plays": pc} for i, pc in enumerate(results) if pc > 0]
                        if not lb: return None
                        lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
                        return lb[0]
                    crown_task = asyncio.create_task(fetch_crown())
            
            a_info = await a_info_task
            crown_winner = await crown_task if crown_task else None

            footer_parts = []
            if a_info and 'artist' in a_info and 'tags' in a_info['artist'] and 'tag' in a_info['artist']['tags']:
                tags = [tag['name'].lower() for tag in a_info['artist']['tags']['tag'][:4]]
                if tags: footer_parts.append(" - ".join(tags))
                
            stats_line = []
            if t_info and 'track' in t_info and t_info['track'].get('userloved') == '1':
                stats_line.append("❤️ Loved track")
            
            if a_info and 'artist' in a_info and 'stats' in a_info['artist']:
                pc = a_info['artist']['stats'].get('userplaycount', 0)
                stats_line.append(f"{pc} artist scrobbles")
                
            if crown_winner:
                stats_line.append(f"👑 {crown_winner['name']} ({crown_winner['plays']} plays)")
            
            if stats_line:
                footer_parts.append(" • ".join(stats_line))
                
            disp_u = 'DJ Scratch' if username.lower() == 'dj-scratch' else username
            if not is_p:
                footer_parts.append("Scrobbles frozen? Run ,outofsync")
                embed.set_footer(text=chr(10).join(footer_parts) if footer_parts else f"Scrobbling as {disp_u} | Scrobbles frozen? Run ,outofsync")
            else:
                embed.set_footer(text=chr(10).join(footer_parts) if footer_parts else f"Scrobbling as {disp_u}")
            
            view = FMActionsView(bot_instance, raw_artist, img, is_p=is_p, cd=cd, user=user, spotify_url=spotify_url, song=raw_song, current_mode="stats", track_data=data)
            result = {"embed": embed, "view": view}
            return result, is_p

        desc_lines = [f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"]
        if show_playcount and track_plays != -1:
            if track_plays == 0 and is_p:
                desc_lines.append("\n🎧 **First time listening!**")
            else:
                desc_lines.append(f"\n🔢 **{track_plays}** plays")
                
        desc = chr(10).join(desc_lines)
        embed = Theme.get_embed(description=desc, color=color)
        embed.set_author(name=f"{format_name(user)}'s {status}", icon_url=user.display_avatar.url)
        if img: embed.set_thumbnail(url=img)
        
        if not is_p:
            footer_text = f"Scrobbling as {'DJ Scratch' if username.lower() == 'dj-scratch' else username} | Scrobbles frozen? Run ,outofsync"
        else:
            footer_text = f"Scrobbling as {'DJ Scratch' if username.lower() == 'dj-scratch' else username}"
        if cd > 0:
            mins, secs = divmod(cd, 60)
            footer_text += f" • Avatar CD: {mins}m {secs}s"
        embed.set_footer(text=footer_text)
        
        view = FMActionsView(bot_instance, raw_artist, img, is_p=is_p, cd=cd, user=user, spotify_url=spotify_url, song=raw_song, current_mode="full", track_data=data)
        result = {"embed": embed, "view": view}
        return result, is_p
    except Exception as e: 
        print(f"parsing error: {e}")
        return {"embed": Theme.get_error_embed(description="Error formatting track.")}, False
async def process_top_artists(user, input_period=None):
    username = await get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)
    
    d_source = await get_user_data_source(user.id)


    lastfm_data = {}
    if username and d_source != 'imported_only':
        if not (api_p.isdigit() and len(api_p) == 4):
            data = await fetch_top_artists(username, api_p, 1000)
            if data and 'topartists' in data:
                lastfm_data = {a['name']: int(a['playcount']) for a in data['topartists']['artist']}

    local_data = {}
    if d_source != 'lastfm_only':
        local_data = await get_local_top_artists(user.id, 100000, api_p, before_dt=None)

    if not username and not local_data:
        return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal."), None, None

    combined = dict(lastfm_data)
    for artist, count in local_data.items():
        combined[artist] = max(combined.get(artist, 0), count)

    sorted_artists = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    if not sorted_artists: return Theme.get_error_embed(description="No artist data found."), None, None

    view = TopItemsPaginator(user, sorted_artists, disp_p, username if d_source != 'imported_only' else None, 'ta')
    embed = view.generate_embed()
    return embed, view, None
async def process_top_tracks(user, input_period=None):
    username = await get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    d_source = await get_user_data_source(user.id)


    lastfm_tracks = {}  # (track, artist) -> plays
    if username and d_source != 'imported_only':
        if not (api_p.isdigit() and len(api_p) == 4):
            data = await fetch_top_tracks(username, api_p, 1000)
            if data and 'toptracks' in data:
                for t in data['toptracks']['track']:
                    key = (t['name'], t['artist']['name'])
                    lastfm_tracks[key] = int(t['playcount'])

    local_tracks = []
    if d_source != 'lastfm_only':
        local_tracks = await get_local_top_tracks(user.id, 100000, api_p, before_dt=None)

    if not username and not local_tracks:
        return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal."), None, None

    combined = dict(lastfm_tracks)
    for track_name, artist_name, plays in local_tracks:
        key = (track_name, artist_name)
        combined[key] = max(combined.get(key, 0), plays)

    sorted_tracks = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    if not sorted_tracks: return Theme.get_error_embed(description="No track data found."), None, None

    view = TopItemsPaginator(user, sorted_tracks, disp_p, username if d_source != 'imported_only' else None, 'tt')
    embed = view.generate_embed()
    return embed, view, None

class TopItemsPaginator(discord.ui.View):
    def __init__(self, user, sorted_items, disp_p, username, cmd_type='tt'):
        super().__init__(timeout=180)
        self.user = user
        self.sorted_items = sorted_items
        self.disp_p = disp_p
        self.username = username
        self.cmd_type = cmd_type
        self.current_page = 0
        self.items_per_page = 10
        self.max_pages = max(1, (len(sorted_items) + self.items_per_page - 1) // self.items_per_page)
        self.update_buttons()

    def update_buttons(self):
        self.prev_button.disabled = self.current_page == 0
        self.next_button.disabled = self.current_page >= self.max_pages - 1

    def generate_embed(self):
        start = self.current_page * self.items_per_page
        end = start + self.items_per_page
        page_items = self.sorted_items[start:end]

        if self.cmd_type == 'tt':
            lines = [f"{get_medal(start + idx)} **{a}** — **{t}** `[{c:,}]`" for idx, ((t, a), c) in enumerate(page_items)]
            title = f"🏆 {format_name(self.user)}'s Top Tracks ({self.disp_p})"
        else:
            lines = [f"{get_medal(start + idx)} **{name}** `[{count:,}]`" for idx, (name, count) in enumerate(page_items)]
            title = f"🏆 {format_name(self.user)}'s Top Artists ({self.disp_p})"
            
        embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now(), user=self.user)
        embed.set_author(name=title, icon_url=self.user.display_avatar.url)
        embed.set_thumbnail(url=self.user.display_avatar.url)
        
        footer_text = f"Page {self.current_page + 1}/{self.max_pages} — {len(self.sorted_items)} items"
        if self.username: footer_text += f"\nScrobbling as {'DJ Scratch' if self.username.lower() == 'dj-scratch' else self.username}"
        else: footer_text += "\nUsing Imported Data"
        embed.set_footer(text=footer_text)
        return embed

    @discord.ui.button(label="", emoji="◀️", style=discord.ButtonStyle.secondary, custom_id="prev")
    async def prev_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This isn't your menu!", ephemeral=True)
        self.current_page -= 1
        self.update_buttons()
        await interaction.response.edit_message(embed=self.generate_embed(), view=self)

    @discord.ui.button(label="", emoji="▶️", style=discord.ButtonStyle.secondary, custom_id="next")
    async def next_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This isn't your menu!", ephemeral=True)
        self.current_page += 1
        self.update_buttons()
        await interaction.response.edit_message(embed=self.generate_embed(), view=self)

    @discord.ui.select(
        placeholder="Select Time Period...",
        options=[
            discord.SelectOption(label="7 Days", value="7day", emoji="🗓️"),
            discord.SelectOption(label="1 Month", value="1month", emoji="📅"),
            discord.SelectOption(label="3 Months", value="3month", emoji="📆"),
            discord.SelectOption(label="6 Months", value="6month", emoji="🕰️"),
            discord.SelectOption(label="1 Year", value="12month", emoji="⏳"),
            discord.SelectOption(label="All Time", value="overall", emoji="♾️"),
        ]
    )
    async def select_callback(self, interaction: discord.Interaction, select: discord.ui.Select):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This menu isn't for you!", ephemeral=True)
        await interaction.response.defer()
        if self.cmd_type == 'ta':
            embed, view, err = await bot.process_top_artists(self.user, select.values[0])
        else:
            embed, view, err = await bot.process_top_tracks(self.user, select.values[0])
        if embed:
            await interaction.message.edit(embed=embed, view=view)
        else:
            await interaction.followup.send(err, ephemeral=True)

class ArtistTracksPaginator(discord.ui.View):
    def __init__(self, user, artist_name, sorted_tracks, total_plays, local_tracks_present):
        super().__init__(timeout=180)
        self.user = user
        self.artist_name = artist_name
        self.sorted_tracks = sorted_tracks
        self.total_plays = total_plays
        self.local_tracks_present = local_tracks_present
        self.current_page = 0
        self.items_per_page = 10
        self.max_pages = max(1, (len(sorted_tracks) + self.items_per_page - 1) // self.items_per_page)
        self.update_buttons()

    def update_buttons(self):
        self.prev_button.disabled = self.current_page == 0
        self.next_button.disabled = self.current_page >= self.max_pages - 1

    def generate_embed(self):
        start = self.current_page * self.items_per_page
        end = start + self.items_per_page
        page_tracks = self.sorted_tracks[start:end]

        lines = [f"{get_medal(start + idx)} **{t}** `[{c:,}]`" for idx, (t, c) in enumerate(page_tracks)]
        
        embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now(), user=self.user)
        embed.set_author(name=f"🏆 Your top tracks for '{self.artist_name}'", icon_url=self.user.display_avatar.url)
        
        footer_text = f"Page {self.current_page + 1}/{self.max_pages} — {len(self.sorted_tracks)} different tracks\n{format_name(self.user)} has {self.total_plays:,} total artist plays"
        embed.set_footer(text=footer_text)
        return embed

    @discord.ui.button(label="", emoji="◀️", style=discord.ButtonStyle.secondary, custom_id="prev")
    async def prev_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This isn't your menu!", ephemeral=True)
        self.current_page -= 1
        self.update_buttons()
        await interaction.response.edit_message(embed=self.generate_embed(), view=self)

    @discord.ui.button(label="", emoji="▶️", style=discord.ButtonStyle.secondary, custom_id="next")
    async def next_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This isn't your menu!", ephemeral=True)
        self.current_page += 1
        self.update_buttons()
        await interaction.response.edit_message(embed=self.generate_embed(), view=self)

async def process_artist_tracks(user, artist_name):
    username = await get_lastfm_username(user.id)
    d_source = await get_user_data_source(user.id)

    if not artist_name:
        if not username or d_source == 'imported_only': return Theme.get_error_embed(description="Link account or provide an artist name."), None, None
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return Theme.get_error_embed(description="You aren't playing anything right now and didn't provide an artist!"), None, None

    lastfm_tracks = {}
    if username and d_source != 'imported_only':
        tracks = await fetch_user_artist_tracks_lastfm(username, artist_name)
        for t_name, playcount in tracks:
            lastfm_tracks[t_name] = playcount

    local_tracks = []
    if d_source != 'lastfm_only':
        local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=None)

    if not username and not local_tracks:
        return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal."), None, None

    combined = dict(lastfm_tracks)
    for track_name, plays in local_tracks:
        combined[track_name] = max(combined.get(track_name, 0), plays)

    sorted_tracks = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    if not sorted_tracks: return Theme.get_error_embed(description=f"No track data found for **{artist_name}**."), None, None

    total_plays = sum(combined.values())
    
    # Optionally get accurate total plays from API if Last.fm is linked
    if username:
        bot_instance = bot
        session = getattr(bot_instance, 'session', None)
        api_plays = await fetch_artist_playcount(session, username, artist_name)
        if api_plays > total_plays: total_plays = api_plays
        elif local_tracks:
            # Add imported data from before registration
            local_artist_plays = sum(p for _, p in local_tracks)
            total_plays = api_plays + local_artist_plays

    view = ArtistTracksPaginator(user, artist_name, sorted_tracks, total_plays, bool(local_tracks))
    embed = view.generate_embed()
    
    return embed, view, None

async def process_recent(user):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)

    username = await get_lastfm_username(user.id)
    d_source = await get_user_data_source(user.id)
    if username and d_source != 'imported_only':
        data = await fetch_now_playing(username, 10)
        if data and 'recenttracks' in data and 'track' in data['recenttracks'] and data['recenttracks']['track']:
            lines = []
            for i, t in enumerate(data['recenttracks']['track'][:10]):
                is_np = i == 0 and t.get('@attr', {}).get('nowplaying') == 'true'
                prefix = "🎶" if is_np else f"` {i+1}. `"
                track_name = t.get('name', 'Unknown Track')
                artist_name = t.get('artist', {}).get('#text', 'Unknown Artist')
                # Fetch timestamp
                ts = ""
                if not is_np and 'date' in t and 'uts' in t['date']:
                    ts = f" <t:{t['date']['uts']}:R>"
                
                track_formatted = f"**{track_name}**{ts}"
                lines.append(f"{prefix} {track_formatted} — *{artist_name}*")
                
            embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{format_name(user)}'s Recent Tracks", icon_url=user.display_avatar.url)
            
            # Use album art for thumbnail if available
            first_track = data['recenttracks']['track'][0]
            thumbnail_url = user.display_avatar.url
            if 'image' in first_track and len(first_track['image']) > 0:
                # get the largest image
                img_url = first_track['image'][-1].get('#text')
                if img_url:
                    thumbnail_url = img_url
                    
            embed.set_thumbnail(url=thumbnail_url)
            embed.set_footer(text=f"Scrobbling as {'DJ Scratch' if username.lower() == 'dj-scratch' else username}")
            return embed, None
    # Fallback to local DB
    if d_source != 'lastfm_only':
        local = await get_local_recent_tracks(user.id, 10)
        if local:
            lines = [f"` {i+1}. ` **{t}**" + (f" <t:{int(ts.timestamp())}:R>" if ts else "") + f" — *{a}*" for i, (t, a, ts) in enumerate(local)]
            embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{format_name(user)}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.set_footer(text=f"Requested by {format_name(user)} • Using Imported Data", icon_url=user.display_avatar.url)
            return embed, None
    if not username:
        return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal."), None
    return Theme.get_error_embed(description=f"No recent tracks found for **{user.name}**."), None


async def process_judge(user):
    username = await get_lastfm_username(user.id)
    
    d_source = await get_user_data_source(user.id)
    # 1. Gather Top 14 Artists
    artists_dict = {}
    if username and d_source != 'imported_only':
        data = await fetch_top_artists(username, 'overall', 50)
        if data and 'topartists' in data:
            for a in data['topartists']['artist']:
                artists_dict[a['name']] = int(a['playcount'])
    
    local_artists = {}
    if d_source != 'lastfm_only':
        local_artists = await get_local_top_artists(user.id, 50, 'overall')
    for a, c in local_artists.items():
        artists_dict[a] = max(artists_dict.get(a, 0), c)
        
    top_artists = sorted(artists_dict.items(), key=lambda x: x[1], reverse=True)[:14]
    
    # 2. Gather Top 16 Tracks
    tracks_dict = {}
    if username:
        data = await fetch_top_tracks(username, 'overall', 50)
        if data and 'toptracks' in data:
            for t in data['toptracks']['track']:
                key = (t['name'], t['artist']['name'])
                tracks_dict[key] = int(t['playcount'])
                
    local_tracks = await get_local_top_tracks(user.id, 50, 'overall')
    for t_name, a_name, plays in local_tracks:
        key = (t_name, a_name)
        tracks_dict[key] = tracks_dict.get(key, 0) + plays

    top_tracks = sorted(tracks_dict.items(), key=lambda x: x[1], reverse=True)[:16]

    if not top_artists and not top_tracks:
        if not username:
            return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal to use the AI Judge."), None
        return Theme.get_error_embed(description=f"Not enough data to judge **{user.name}**."), None

    # Format the data exactly like fmbot
    artist_lines = [f"{a[:40]} - {c} plays" for a, c in top_artists]
    track_lines = [f"{a[:40]} - {t[:50]} - {c} plays" for (t, a), c in top_tracks]
    
    user_data = "My top artists:\n" + "\n".join(artist_lines) + "\n\nMy top tracks:\n" + "\n".join(track_lines)

    try:
        system_prompt = (
            "You are an incredibly witty, brutally creative, and oddly specific AI music critic. "
            "Roast my music taste based on my all-time top artists and top tracks. "
            "Your roast must be structured as 3-4 short paragraphs. "
            "DO NOT just list the music. Instead, weave the artists and tracks into highly specific, hilarious, and absurd situational analogies (e.g., 'a leather jacket bought at an airport gift shop', 'a dad-rock support group', 'the metal uncle who wandered into the wrong family reunion'). "
            "Group artists together that share a vibe, or hilariously contrast ones that cause severe emotional whiplash. "
            "Format artist and track names in *italics*. "
            "Keep the tone sarcastic, punchy, vivid, and under 1500 characters. "
            "Conclude with a final, devastating one-liner summarizing my musical identity."
        )
        
        api_key = os.getenv("GROQ_API_KEY", "").strip().strip("'").strip('"')
        
        if not api_key:
            return Theme.get_error_embed(description="Please get a free Groq API key from console.groq.com/keys and put it in your .env as GROQ_API_KEY!"), None

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_data}
            ]
        }
        
        bot_instance = bot
        session = getattr(bot_instance, 'session', None)
        local_session = False
        if session is None:
            import aiohttp
            session = aiohttp.ClientSession()
            local_session = True

        roast_text = ""
        try:
            import aiohttp
            async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    roast_text = data['choices'][0]['message']['content']
                else:
                    err_text = await resp.text()
                    print(f"Groq API Error {resp.status}: {err_text}")
                    roast_text = "<:404:882220605783560222> OpenAI API error - please try again"
        except Exception as e:
            print(f"Groq API Request Error: {e}")
            roast_text = "<:404:882220605783560222> OpenAI API error - please try again"
        finally:
            if local_session:
                await session.close()
        
        roast_text = f"> {roast_text.replace(chr(10), chr(10) + '> ')}" if roast_text else ""
        embed = Theme.get_embed(
            description=roast_text,
            color=0xFF7A01,
            timestamp=datetime.now()
        )
        embed.set_author(name=f"{format_name(user)}'s .fmbot AI judgement - Roast 🔥", icon_url=user.display_avatar.url)
        embed.set_footer(text="Powered by Groq")
        return embed, None
    except Exception as e:
        print(f"Judge API Error: {e}")
        return Theme.get_error_embed(description="An error occurred while contacting the AI Judge. Try again later."), None

async def process_profile(user):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)

    username = await get_lastfm_username(user.id)
    local_total = await get_local_total_plays(user.id)

    d_source = await get_user_data_source(user.id)

    if not username and d_source == 'lastfm_only':
        return Theme.get_error_embed(description=f"**{user.name}** hasn't linked a Last.fm account! Link it with `/login` or import history on the web portal."), None, None

    class ProfileLinksView(discord.ui.View):
        def __init__(self, username, lastfm_url):
            super().__init__(timeout=None)
            safe_name = urllib.parse.quote(format_name(user).replace(' ', '-'))
            self.add_item(discord.ui.Button(label="DJ Scratch Profile", style=discord.ButtonStyle.link, url=f"https://dj-scratch.vercel.app/{safe_name}"))
            if lastfm_url:
                self.add_item(discord.ui.Button(label="Last.fm Profile", style=discord.ButtonStyle.link, url=lastfm_url))

    view = None

    embed = Theme.get_embed(color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{format_name(user)}'s Profile", icon_url=user.display_avatar.url)

    if username:
        data = await fetch_user_profile(username)
        if data:
            if 'error' in data or 'user' not in data:
                return Theme.get_error_embed(description=f"Last.fm Error: {data.get('message', 'User not found on Last.fm.')}"), None, None
            info = data['user']
            embed.title = f"{info['name']}'s DJ Scratch Profile"
            safe_name = urllib.parse.quote(format_name(user).replace(' ', '-'))
            embed.url = f"https://dj-scratch.vercel.app/{safe_name}"
            lastfm_plays = int(info['playcount'])
            view = ProfileLinksView(username, info['url'])
            
            # Smart De-duplication of duplicate plays:
            if d_source == 'imported_only':
                total = local_total
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
            elif d_source == 'lastfm_only':
                total = lastfm_plays
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            else:
                total = max(lastfm_plays, local_total)
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                if local_total > 0:
                    embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
                    embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
            
            if local_total > 0 and d_source != 'imported_only':
                overlap = (lastfm_plays + local_total) - total
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles using MAX deduplication.")
    elif local_total > 0:
        embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
        embed.add_field(name="ℹ️ Last.fm", value="Not linked — use `/login`", inline=True)

    return embed, view, None
async def process_whoknows(guild, user, artist_name):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)
    if not guild: return Theme.get_error_embed(description="Must be used in a server."), None
    users_db = await load_users()
    display_names = await load_display_names()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return Theme.get_error_embed(description="No one in this server has linked their account."), None
    if not artist_name:
        username = await get_lastfm_username(user.id)
        if not username: return Theme.get_error_embed(description="Link account or provide an artist name."), None
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return Theme.get_error_embed(description="You aren't playing anything right now!"), None

    lb = []
    tasks = [(uid, lname, fetch_artist_playcount(session, lname, artist_name)) for uid, lname in linked.items()]
    results = await asyncio.gather(*(t[2] for t in tasks))
    for idx, pc in enumerate(results):
        if pc > 0:
            uid = tasks[idx][0]
            custom_name = display_names.get(uid)
            if custom_name:
                name = custom_name
            else:
                member = guild.get_member(int(uid))
                name = member.display_name if member else tasks[idx][1]
            lb.append({"name": name, "plays": pc})

    if not lb: return Theme.get_error_embed(description=f"No one here listens to **{artist_name}**."), None
    lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
    lines = [f"{get_medal(i)} **{u['name']}** — **{u['plays']:,}** plays" for i, u in enumerate(lb[:15])]
    embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"Who knows {artist_name} in {guild.name}?", icon_url=guild.icon.url if guild.icon else None)
    embed.set_thumbnail(url=user.display_avatar.url)
    
    footer_text = f"Requested by {format_name(user)}"
    if lb[0]['name'] == format_name(user): footer_text = "👑 You hold the crown! • " + footer_text
    embed.set_footer(text=footer_text)
    return embed, None
async def process_suggestion(ctx_int, user, suggestion_text, is_bug=False):
    try:
        title = "Bug Report" if is_bug else "Bot Suggestion"
        description = suggestion_text
        
        global db_pool
        if db_pool:
            import asyncpg
            if isinstance(db_pool, asyncpg.pool.Pool):
                async with db_pool.acquire() as conn:
                    await conn.execute(
                        "INSERT INTO suggestions (user_id, username, title, description) VALUES ($1, $2, $3, $4)",
                        str(user.id), str(format_name(user)), title, description
                    )
            else:
                print(f"DB pool not found or wrong type, skipping DB insert.")

        owner = await bot.fetch_user(OWNER_ID)
        
        embed_title = "🐛 New Bug Report" if is_bug else "💡 New Bot Suggestion"
        embed_color = discord.Color.red() if is_bug else discord.Color.gold()
        
        embed = Theme.get_embed(title=embed_title, description=suggestion_text, color=embed_color, timestamp=datetime.now())
        embed.set_author(name=f"{format_name(user)} ({user.id})", icon_url=user.display_avatar.url)
        guild_name = ctx_int.guild.name if getattr(ctx_int, 'guild', None) else "DMs / User App"
        embed.set_footer(text=f"Sent from: {guild_name} | Saved to Dashboard")
        view_to_send = BugReportView() if is_bug else SuggestionView()
        await owner.send(embed=embed, view=view_to_send)
        print(f"{Log.GREEN}>>> New {'bug report' if is_bug else 'suggestion'} forwarded to owner & DB.{Log.RESET}")
        
        confirm_text = "✅ Bug report saved to your Dashboard & sent directly to the developer!" if is_bug else "✅ Suggestion saved to your Dashboard & sent directly to the developer!"
        confirm = Theme.get_embed(description=confirm_text, color=discord.Color.green())
        
        if isinstance(ctx_int, discord.Interaction): await ctx_int.response.send_message(embed=confirm, ephemeral=True)
        else: await ctx_int.send(embed=confirm)
    except Exception as e:
        print(f"Suggestion/Bug report error: {e}")
async def process_crowns(guild, user):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)

    if not guild: return Theme.get_error_embed(description="Must be used in a server."), None
    username = await get_lastfm_username(user.id)
    if not username: return Theme.get_error_embed(description="Link your account first with `/login`"), None
    
    users_db = await load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return Theme.get_error_embed(description="No one in this server has linked their account."), None
    
    top_artists_data = await fetch_top_artists(username, 'overall', 15)
    if not top_artists_data or 'topartists' not in top_artists_data: return Theme.get_error_embed(description="Error fetching your top artists."), None
    
    artists_to_check = [a['name'] for a in top_artists_data['topartists']['artist']]
    if not artists_to_check: return Theme.get_error_embed(description="You don't have any artists in your history!"), None

    async def check_artist(artist):
        tasks = [(uid, fetch_artist_playcount(session, lname, artist)) for uid, lname in linked.items()]
        results = await asyncio.gather(*(t[1] for t in tasks))
        top_plays = max(results) if results else 0
        if top_plays > 0:
            top_user = tasks[results.index(top_plays)][0]
            if top_user == str(user.id): return (artist, top_plays)
        return None

    artist_results = await asyncio.gather(*(check_artist(artist) for artist in artists_to_check))
    crowns = [r for r in artist_results if r is not None]
    
    if not crowns:
        return Theme.get_error_embed(description="You don't hold any crowns for your top 15 artists in this server!"), None
        
    lines = [f"👑 **{artist}** — **{plays:,}** plays" for artist, plays in crowns]
    embed = Theme.get_embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{format_name(user)}'s Crowns in {guild.name}", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text=f"Checked your top 15 artists • Requested by {format_name(user)}", icon_url=user.display_avatar.url)
    return embed, None








class HelpDropdown(discord.ui.Select):
    def __init__(self, is_owner=False):
        options = [
            discord.SelectOption(label="🚀 Getting Started", description="Quick guide on how to set up the bot", emoji="🚀"),
            discord.SelectOption(label="🎧 Last.fm Commands", description="Commands for tracking and viewing your Last.fm stats", emoji="🎧"),
            discord.SelectOption(label="👑 Server Stats", description="See who listens to what the most in the server", emoji="👑"),
            discord.SelectOption(label="💡 Utility & Fun", description="Settings, games, and other utility commands", emoji="💡")
        ]
        if is_owner:
            options.append(discord.SelectOption(label="🛡️ Owner Commands", description="Admin restricted commands", emoji="🛡️"))
            
        super().__init__(placeholder="Choose a command category...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        from src.core.theme import Theme
        
        embed = Theme.get_embed(user=interaction.user)
        embed.set_author(name=f"Help: {self.values[0]}", icon_url=interaction.user.display_avatar.url)
        embed.set_thumbnail(url=interaction.client.user.display_avatar.url)
        
        if self.values[0] == "🚀 Getting Started":
            embed.description = (
                "**Welcome to DJ Scratch!**\n\n"
                "**1️⃣ Link your Last.fm**\n"
                "Use `/login` to securely link your Last.fm account.\n\n"
                "**2️⃣ Listen to Music**\n"
                "Start playing music on Spotify or Apple Music (ensure they are connected in your Last.fm settings).\n\n"
                "**3️⃣ View your Current Song**\n"
                "Type `,fm` or `/fm` in any channel to display the song you are currently listening to.\n\n"
                "**4️⃣ Explore More Commands**\n"
                "Try `,ta` to see your top artists, `,tt` for top tracks, or `,wk <artist>` to see who in the server listens to an artist the most!"
            )
        elif self.values[0] == "🎧 Last.fm Commands":
            embed.description = (
                "`/login` - Link your Last.fm account\n"
                "`/fm` (or `,fm`, `,np`) - View your currently playing track\n"
                "`/topartists` (or `,ta`) - View your top played artists\n"
                "`/toptracks` (or `,tt`) - View your top played tracks\n"
                "`/artisttracks` (or `,at`) - View your top played tracks for an artist\n"
                "`/recent` (or `,rt`) - View your recent listening history\n"
                "`/profile` (or `,s`) - View your Last.fm stats\n"
                "`/import` (or `,import`) - Upload your Spotify ZIP or JSON directly"
            )
        elif self.values[0] == "👑 Server Stats":
            embed.description = (
                "`/whoknows` (or `,wk`) - See who listens to an artist most in the server\n"
                "`/crowns` (or `,crowns`) - See which of your top artists you have the most plays for in the server"
            )
        elif self.values[0] == "💡 Utility & Fun":
            embed.description = (
                "`/settings` (or `,settings`) - Customize your bot preferences\n"
                "`/status` (or `,status`) - View the bot's health and server stats\n"
                "`/updates` (or `,updates`) - Read the latest bot news\n"
                "`/suggest` (or `,suggest`) - Send a suggestion directly to the developer\n"
                "`/deletedata` (or `,deletedata`) - Permanently delete all your database data\n"
                "`/guess` (or `,guess`) - Play a game guessing a pixelated album cover\n"
                "`/scramble` (or `,scramble`) - Play a game unscrambling an artist's name"
            )
        elif self.values[0] == "🛡️ Owner Commands":
            embed.description = (
                "`,sync` - Sync slash commands globally\n"
                "`,stats` (or `,guilds`, `,servers`) - View server usage statistics\n"
                "`,cleanduplicates` - Scan and clean duplicate database entries\n"
                "`,wipedata` - Wipe all imported user data\n"
                "`,testautorestart` - Simulate high RAM auto-restart\n"
                "`,restart` - Manually restart the bot\n"
                "`,resetcd` - Bypass the global avatar cooldown"
            )
            
        await interaction.response.edit_message(embed=embed, view=self.view)

class HelpView(discord.ui.View):
    def __init__(self, is_owner=False):
        super().__init__(timeout=None)
        self.add_item(HelpDropdown(is_owner))

def get_help_embed(user, bot_user):
    from src.core.theme import Theme
    is_owner = user.id == 759433582107426816
    embed = Theme.get_embed(
        title="🤖 DJ Scratch | Command Center", 
        description="Welcome to **DJ Scratch**!\nSelect a category from the dropdown menu below to see available commands.",
        user=user
    )
    embed.set_thumbnail(url=bot_user.display_avatar.url)
    embed.set_author(name=format_name(user), icon_url=user.display_avatar.url)
    return embed, HelpView(is_owner)

# --- ADMIN COMMAND ---



# --- SLASH COMMANDS ---











# --- PREFIX COMMAND ---






















class PurgeConfirmView(discord.ui.View):
    def __init__(self, user):
        super().__init__(timeout=30)
        self.user = user
        self.confirmed = False

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.user.id:
            await interaction.response.send_message("❌ This confirmation is not for you!", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="Confirm Delete", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        self.confirmed = True
        self.stop()
        
        deleted_count = 0
        if db_pool:
            try:
                async with db_pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT COUNT(*) FROM listens WHERE user_id=$1", str(self.user.id))
                    deleted_count = row[0] if row else 0
                    await conn.execute("DELETE FROM listens WHERE user_id=$1", str(self.user.id))
                    await conn.execute("DELETE FROM imported_users WHERE id=$1", str(self.user.id))
            except Exception as e:
                print(f"{Log.RED}>>> Error purging user data from DB: {e}{Log.RESET}")
        
        embed = Theme.get_embed(
            title="🗑️ Data Successfully Deleted",
            description=(
                f"Your data has been fully purged from the database:\n\n"
                f"• **{deleted_count:,}** imported listens deleted.\n\n"
                f"All your data has been completely and permanently erased!"
            ),
            color=discord.Color.red(),
            timestamp=datetime.now()
        )
        await interaction.edit_original_response(embed=embed, view=None)

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.stop()
        embed = Theme.get_embed(
            description="❌ **Purge cancelled.** Your data remains completely safe.",
            color=discord.Color.blue()
        )
        await interaction.response.edit_message(embed=embed, view=None)




@app_commands.describe(layout="Choose your default layout")
@app_commands.choices(layout=[
    app_commands.Choice(name="Compact Text (fm1)", value="compact"),
    app_commands.Choice(name="Full Embed (fm2)", value="full"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def set_custom_fm_slash(interaction: discord.Interaction, layout: app_commands.Choice[str]):
    print(f"[/setcustomfm] Triggered by {format_name(interaction.user)}")
    if not db_pool:
        await interaction.response.send_message("❌ Database is currently offline.", ephemeral=True)
        return

    success = await set_user_fm_mode(interaction.user.id, layout.value)
    if success:
        display = "Compact Text (fm1)" if layout.value == "compact" else "Full Embed (fm2)"
        await interaction.response.send_message(f"✅ Your default `/fm` response is now set to **{display}**!", ephemeral=True)
    else:
        await interaction.response.send_message("❌ Failed to save setting to the database.", ephemeral=True)




# --- AUTO-TRIGGER & REACTIONS ---
@bot.event
async def on_message(message):
    if message.author == bot.user: return
    
    content_lower = message.content.lower()
    is_stats_bot = (message.author.name == "stats.fm")
    has_phrase = ("is currently listening to" in content_lower)

    if is_stats_bot or has_phrase:
        await add_custom_reactions(message)

    await bot.process_commands(message)

async def process_receipt(user, period='overall', limit=10):
    from ..utils.images import generate_receipt_image
    from ..utils.api import fetch_top_tracks
    import discord
    
    username = await get_lastfm_username(user.id)
    if not username:
        return Theme.get_error_embed(description=f"You have not linked your Last.fm account! Use `/login` to link it."), None, None
        
    data = await fetch_top_tracks(username, period, limit)
    if not data or 'toptracks' not in data or not data['toptracks']['track']:
        return Theme.get_error_embed(description="Could not fetch top tracks for the receipt."), None, None
        
    tracks_raw = data['toptracks']['track']
    tracks = []
    for t in tracks_raw:
        tracks.append((t['name'], t['artist']['name'], int(t['playcount'])))
        
    buf = generate_receipt_image(username, period, tracks)
    file = discord.File(buf, filename="receipt.png")
    
    embed = Theme.get_embed(title=f"🧾 {format_name(user)}'s Top Tracks Receipt", color=LASTFM_COLOR)
    embed.set_image(url="attachment://receipt.png")
    
    return embed, file, None
# --- UPDATE NOTIFICATIONS ---
CACHED_GLOBAL_UPDATE_VERSION = None
CACHED_GLOBAL_UPDATE_MESSAGE = None

async def check_update_notification(user_id: int, send_message_func):
    try:
        from src.core.database import get_global_update_version, get_user_update_notifs, get_user_last_update_seen, set_user_last_update_seen
        global CACHED_GLOBAL_UPDATE_VERSION
        
        if CACHED_GLOBAL_UPDATE_VERSION is None:
            CACHED_GLOBAL_UPDATE_VERSION = await get_global_update_version()
            
        current_version = CACHED_GLOBAL_UPDATE_VERSION
        if not current_version:
            return

        wants_notifs = await get_user_update_notifs(user_id)
        if not wants_notifs:
            return
            
        last_seen = await get_user_last_update_seen(user_id)
        if last_seen != current_version:
            await set_user_last_update_seen(user_id, current_version)
            await send_message_func()
    except Exception as e:
        print(f"Silently caught error in update notification check: {e}")

class DismissUpdateView(discord.ui.View):
    def __init__(self, user_id: int):
        super().__init__(timeout=60.0)
        self.user_id = user_id

    @discord.ui.button(label="Dismiss", style=discord.ButtonStyle.secondary, emoji="🗑️")
    async def dismiss(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id == self.user_id:
            try:
                await interaction.message.delete()
            except:
                pass
        else:
            await interaction.response.send_message("Only the person who triggered this update can dismiss it.", ephemeral=True)

@bot.listen('on_command_completion')
async def update_notif_prefix(ctx):
    from src.core.database import get_global_update_message
    async def send_msg():
        global CACHED_GLOBAL_UPDATE_MESSAGE
        try:
            if CACHED_GLOBAL_UPDATE_MESSAGE is None:
                CACHED_GLOBAL_UPDATE_MESSAGE = await get_global_update_message()
            msg = CACHED_GLOBAL_UPDATE_MESSAGE
            version = CACHED_GLOBAL_UPDATE_VERSION if 'CACHED_GLOBAL_UPDATE_VERSION' in globals() else ""
            
            embed = Theme.get_embed(
                title=f"🎉 DJ Scratch Update `{version}`",
                description=msg, 
                color=0x10b981
            )
            embed.set_footer(text="You can disable these update notifications in /settings")
            view = DismissUpdateView(ctx.author.id)
            await ctx.send(f"<@{ctx.author.id}>", embed=embed, view=view, delete_after=60.0)
        except Exception:
            pass
    await check_update_notification(ctx.author.id, send_msg)

@bot.listen('on_app_command_completion')
async def update_notif_slash(interaction, command):
    from src.core.database import get_global_update_message
    async def send_msg():
        global CACHED_GLOBAL_UPDATE_MESSAGE
        try:
            if CACHED_GLOBAL_UPDATE_MESSAGE is None:
                CACHED_GLOBAL_UPDATE_MESSAGE = await get_global_update_message()
            msg = CACHED_GLOBAL_UPDATE_MESSAGE
            version = CACHED_GLOBAL_UPDATE_VERSION if 'CACHED_GLOBAL_UPDATE_VERSION' in globals() else ""
            
            embed = Theme.get_embed(
                title=f"🎉 DJ Scratch Update `{version}`",
                description=msg, 
                color=0x10b981
            )
            embed.set_footer(text="You can disable these update notifications in /settings")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception:
            pass
    await check_update_notification(interaction.user.id, send_msg)

class DirectMessageReplyModal(discord.ui.Modal, title="Reply via DM"):
    reply_content = discord.ui.TextInput(
        label="Message",
        style=discord.TextStyle.long,
        placeholder="Type your message here...",
        required=True
    )

    def __init__(self, target_id: str):
        super().__init__()
        self.target_id = target_id

    async def on_submit(self, interaction: discord.Interaction):
        sender_id = str(interaction.user.id)
        content = self.reply_content.value
        
        global db_pool
        pool = db_pool
        if not pool:
            await interaction.response.send_message("Database connection error.", ephemeral=True)
            return

        async with pool.acquire() as conn:
            # Check if they are friends
            is_friend = await conn.fetchval(
                "SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'accepted'",
                sender_id, self.target_id
            )
            if not is_friend:
                await interaction.response.send_message("You must be friends to send messages.", ephemeral=True)
                return

            await conn.execute(
                "INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)",
                sender_id, self.target_id, content
            )
            
            try:
                target_user = await bot.fetch_user(int(self.target_id))
                sender_name = await conn.fetchval("SELECT display_name FROM user_settings WHERE user_id = $1", sender_id)
                if not sender_name:
                    sender_name = interaction.user.name
                    
                view = discord.ui.View()
                btn = discord.ui.Button(label="Open Web Dashboard", style=discord.ButtonStyle.link, url="https://the-goats-dj.vercel.app/messages")
                view.add_item(btn)
                
                embed = Theme.get_embed(
                    title="💬 New Direct Message",
                    description=content,
                    color=discord.Color.blurple(),
                    timestamp=discord.utils.utcnow()
                )
                embed.set_author(
                    name=sender_name,
                    icon_url=interaction.user.display_avatar.url
                )
                embed.set_footer(text="DJ Scratch • Activity DM")
                
                await target_user.send("*(To reply, launch the DJ Scratch Activity using the 🚀 icon below, or click the button)*", embed=embed, view=view)
                await interaction.response.send_message("Reply sent successfully!", ephemeral=True)
            except Exception as e:
                print(e)
                await interaction.response.send_message("Reply saved, but failed to DM the user on Discord.", ephemeral=True)

@bot.listen('on_interaction')
async def on_interaction(interaction: discord.Interaction):
    from .database import db_pool
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO user_settings (user_id, discord_username, display_name) 
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id) DO UPDATE SET 
                        discord_username = EXCLUDED.discord_username,
                        display_name = EXCLUDED.display_name
                """, str(interaction.user.id), interaction.user.name, interaction.user.display_name)
        except Exception:
            pass

    if interaction.type == discord.InteractionType.component:
        custom_id = interaction.data.get("custom_id", "")
        
        if custom_id.startswith("accept_friend_"):
            sender_id = custom_id.replace("accept_friend_", "")
            receiver_id = str(interaction.user.id)
            
            pool = db_pool
            if not pool:
                await interaction.response.send_message("Database connection error.", ephemeral=True)
                return
                
            async with pool.acquire() as conn:
                existing = await conn.fetchval(
                    "SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2",
                    sender_id, receiver_id
                )
                if existing == 'pending':
                    await conn.execute("UPDATE friends SET status='accepted' WHERE user_id=$1 AND friend_id=$2", sender_id, receiver_id)
                    await conn.execute(
                        "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'",
                        receiver_id, sender_id
                    )
                    
                    try:
                        await interaction.response.edit_message(content=f"✅ You accepted the friend request from <@{sender_id}>!", view=None)
                    except:
                        await interaction.response.send_message(f"✅ You accepted the friend request from <@{sender_id}>!", ephemeral=True)
                        
                    try:
                        sender_user = await bot.fetch_user(int(sender_id))
                        await sender_user.send(f"**{interaction.user.name}** accepted your friend request on DJ Scratch!")
                    except:
                        pass
                else:
                    await interaction.response.send_message("This friend request is no longer valid or already accepted.", ephemeral=True)
                    
        elif custom_id.startswith("reply_dm_"):
            target_id = custom_id.replace("reply_dm_", "")
            await interaction.response.send_modal(DirectMessageReplyModal(target_id=target_id))
            
        elif custom_id.startswith("spotify_"):
            parts = custom_id.split(":")
            if len(parts) == 2:
                action, owner_id = parts[0], parts[1]
                if str(interaction.user.id) != owner_id:
                    await interaction.response.send_message("This is not your remote!", ephemeral=True)
                    return
                
                # Check for token or get it dynamically if needed - actually the api functions do it
                app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
                
                async def handle_spotify_response(res):
                    if res == "no_token":
                        await interaction.response.send_message(f"You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={interaction.user.id})", ephemeral=True)
                    elif res is True:
                        await interaction.response.send_message("Action successful!", ephemeral=True)
                    else:
                        await interaction.response.send_message(f"Failed: {res}", ephemeral=True)
                
                from src.core.spotify import spotify_skip_to_previous, spotify_pause_playback, spotify_play_track, spotify_skip_to_next
                
                async with aiohttp.ClientSession() as session:
                    if action == "spotify_prev":
                        res = await spotify_skip_to_previous(session, owner_id)
                        await handle_spotify_response(res)
                    elif action == "spotify_play":
                        res = await spotify_pause_playback(session, owner_id)
                        if res is not True:
                            res = await spotify_play_track(session, owner_id)
                        await handle_spotify_response(res)
                    elif action == "spotify_next":
                        res = await spotify_skip_to_next(session, owner_id)
                        await handle_spotify_response(res)
                        
        elif custom_id.startswith("fm_up:") or custom_id.startswith("fm_down:"):
            parts = custom_id.split(":")
            if len(parts) >= 3:
                action = parts[0]
                user_id_str = parts[1]
                current_mode = parts[2]
                unique_id = parts[3] if len(parts) > 3 else None
                
                try:
                    target_user = await bot.fetch_user(int(user_id_str))
                except:
                    target_user = interaction.user
                    
                new_mode = "full"
                if action == "fm_up":
                    new_mode = "full" if current_mode == "stats" else "compact"
                else:
                    new_mode = "full" if current_mode == "compact" else "stats"
                    
                await interaction.response.defer()
                cached_data = FM_TRACK_CACHE.get(unique_id) if unique_id else None
                result, _ = await process_fm(interaction, target_user, mode=new_mode, track_data=cached_data)
                if result:
                    content = result.get('content')
                    if not interaction.response.is_done():
                        await interaction.response.edit_message(content=content, embed=result.get('embed'), view=result.get('view'))
                    else:
                        await interaction.edit_original_response(content=content, embed=result.get('embed'), view=result.get('view'))
                        
        elif custom_id.startswith("fm_lyrics:"):
            parts = custom_id.split(":")
            if len(parts) >= 3:
                artist = parts[1]
                song = ":".join(parts[2:])
                
                await interaction.response.defer(ephemeral=True)
                from src.core.lyrics import fetch_lyrics
                session = getattr(bot, 'session', None)
                if not session:
                    session = aiohttp.ClientSession()
                    bot.session = session
                lyrics_data = await fetch_lyrics(session, artist, song)
                if lyrics_data and (lyrics_data.get("synced") or lyrics_data.get("plain")):
                    from src.core.karaoke import KaraokeLyricsView
                    
                    # WORKAROUND: Check Spotify OAuth first!
                    start_time = 0.0
                    from src.utils.spotify import fetch_user_currently_playing
                    spotify_progress = await fetch_user_currently_playing(str(interaction.user.id))
                    
                    if spotify_progress > 0:
                        start_time = spotify_progress
                    else:
                        # Fallback: Check Discord Rich Presence
                        if isinstance(interaction.user, discord.Member):
                            for activity in interaction.user.activities:
                                if isinstance(activity, discord.Spotify):
                                    if artist.lower() in activity.artist.lower() or song.lower() in activity.title.lower():
                                        import datetime
                                        now = datetime.datetime.now(datetime.timezone.utc)
                                        elapsed = (now - activity.start).total_seconds()
                                        start_time = max(0.0, elapsed)
                                        break
                                    
                    view = KaraokeLyricsView(artist, song, lyrics_data.get("synced"), lyrics_data.get("plain"), start_time=start_time)
                    embed = view._build_embed()
                    view.message = await interaction.followup.send(embed=embed, view=view, ephemeral=True)
                else:
                    await interaction.followup.send("Could not find lyrics for this track.", ephemeral=True)
                    
        elif custom_id.startswith("fm_preview:"):
            parts = custom_id.split(":")
            if len(parts) >= 2:
                # Handle old format (fm_preview:artist), new format (fm_preview:user_id:artist), and newest (fm_preview:user_id:unique_id:artist)
                unique_id = None
                if len(parts) >= 4 and parts[1].isdigit() and len(parts[2]) == 8:
                    target_user_id = parts[1]
                    unique_id = parts[2]
                    artist = ":".join(parts[3:])
                elif len(parts) >= 3 and parts[1].isdigit():
                    target_user_id = parts[1]
                    artist = ":".join(parts[2:])
                else:
                    target_user_id = None
                    artist = ":".join(parts[1:])
                    
                target_user = None
                if target_user_id:
                    target_user = bot.get_user(int(target_user_id))
                    if not target_user:
                        try:
                            target_user = await bot.fetch_user(int(target_user_id))
                        except:
                            pass
                if not target_user:
                    target_user = interaction.user

                img_url = None
                if interaction.message.embeds and len(interaction.message.embeds) > 0:
                    embed = interaction.message.embeds[0]
                    if embed.thumbnail and embed.thumbnail.url:
                        img_url = embed.thumbnail.url
                    elif embed.image and embed.image.url:
                        img_url = embed.image.url
                        
                if not img_url:
                    await interaction.response.send_message(f"Please re-run the `/fm` command to preview the avatar for **{artist}** (Image not found).", ephemeral=True)
                    return
                
                preview_embed = Theme.get_embed(
                    title="Bot Avatar Preview", 
                    description=f"This is how the bot will look if you apply the album art for **{artist}**.", 
                    color=LASTFM_COLOR
                )
                from src.core.database import format_name
                preview_embed.set_author(name=format_name(target_user), icon_url=img_url)
                preview_embed.set_image(url=img_url)
                
                track_data = None
                if unique_id:
                    track_data = FM_TRACK_CACHE.get(unique_id)
                
                apply_view = ApplyAvatarView(bot, artist, img_url, original_msg=interaction.message, original_user=target_user, track=None, track_data=track_data)
                await interaction.response.send_message(embed=preview_embed, view=apply_view, ephemeral=True)
