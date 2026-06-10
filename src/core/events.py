import os
import discord
import aiohttp
import json
import asyncio
import urllib.parse
from discord.ext import commands, tasks
from discord import app_commands
from dotenv import load_dotenv
from datetime import datetime, timedelta
import asyncpg
from ..utils.api import *

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
bot = commands.Bot(command_prefix=",", intents=intents)
bot.remove_command('help')

# === LAST.FM CONFIG ===
LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
OWNER_ID = 759433582107426816
USERS_FILE = "lastfm_users.json"
COOLDOWN_FILE = "avatar_cooldown.txt"
LASTFM_COLOR = 0xba0000 
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
    if index == 0: return "🥇"
    if index == 1: return "🥈"
    if index == 2: return "🥉"
    return f"` {index+1}. `"

# --- SUGGESTION VIEW ---
class SuggestionView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    async def handle_action(self, interaction: discord.Interaction, status: str, color: discord.Color, emoji: str):
        embed = interaction.message.embeds[0]
        try:
            suggester_id = int(embed.author.name.split('(')[-1].strip(')'))
        except: suggester_id = None

        embed.color = color
        embed.add_field(name="Status", value=f"{emoji} **{status}**", inline=False)
        for child in self.children: child.disabled = True
        await interaction.response.edit_message(embed=embed, view=self)

        if suggester_id:
            try:
                suggester = await interaction.client.fetch_user(suggester_id)
                desc_lines = [f"**Suggestion:** {embed.description}", f"**Status:** {emoji} {status}"]
                notify_embed = discord.Embed(title=f"Suggestion {status}", description=chr(10).join(desc_lines), color=color)
                await suggester.send(embed=notify_embed)
                print(f"{Log.GREEN}>>> Notified user about suggestion: {status}{Log.RESET}")
            except: pass

    @discord.ui.button(label="Accept", style=discord.ButtonStyle.success, custom_id="sugg_accept")
    async def accept_btn(self, i: discord.Interaction, b: discord.ui.Button): await self.handle_action(i, "Accepted", discord.Color.green(), "✅")
    @discord.ui.button(label="Working", style=discord.ButtonStyle.primary, custom_id="sugg_working")
    async def working_btn(self, i: discord.Interaction, b: discord.ui.Button): await self.handle_action(i, "Working On It", discord.Color.orange(), "🛠️")
    @discord.ui.button(label="Deny", style=discord.ButtonStyle.danger, custom_id="sugg_deny")
    async def deny_btn(self, i: discord.Interaction, b: discord.ui.Button): await self.handle_action(i, "Denied", discord.Color.red(), "❌")

async def setup_hook():
    bot.session = aiohttp.ClientSession()
    bot.add_view(SuggestionView())
    global db_pool
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if db_url:
        try:
            db_pool = await asyncpg.create_pool(dsn=db_url, ssl="require")
            
            # Pass the pool to the database module
            import src.core.database as db_module
            db_module.db_pool = db_pool
            
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
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_features BOOLEAN DEFAULT FALSE")
                except Exception as e:
                    print(f"Failed to add show_features column: {e}")
                    
                try:
                    await conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'combined'")
                except Exception as e:
                    print(f"Failed to add data_source column: {e}")
                    
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
                    CREATE TABLE IF NOT EXISTS voice_transmissions (
                        id SERIAL PRIMARY KEY,
                        channel_id VARCHAR(255) NOT NULL,
                        audio_base64 TEXT NOT NULL,
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
                    print(f"Failed to add lastfm_username column: {e}")

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

            cogs = ['cogs.admin', 'src.commands.lastfm', 'src.commands.importer', 'src.commands.settings', 'src.commands.voice_ipc', 'src.commands.info']
            for cog in cogs:
                try:
                    await bot.load_extension(cog)
                    print(f"{Log.GREEN}>>> Loaded {cog}{Log.RESET}")
                except Exception as e:
                    print(f"{Log.RED}>>> Failed to load {cog}: {e}{Log.RESET}")
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.YELLOW}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
bot.setup_hook = setup_hook

db_pool = None







import discord
import json
import ijson
import zipfile
import io
import uuid
from datetime import datetime
from .database import *
def stream_parse_spotify_json(file_obj):
    buffer = ""
    brace_count = 0
    in_string = False
    escape = False

    while True:
        chunk = file_obj.read(65536)  # Read in small 64KB chunks to consume minimal RAM
        if not chunk:
            break
        
        for char in chunk:
            buffer += char
            
            if escape:
                escape = False
                continue
            
            if char == '\\':
                escape = True
                continue
                
            if char == '"':
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    if brace_count == 0:
                        buffer = "{"
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        try:
                            track = json.loads(buffer)
                            yield track
                        except:
                            pass
                        buffer = ""
def parse_single_spotify_track(user, track):
    artist = track.get("master_metadata_album_artist_name")
    title = track.get("master_metadata_track_name")
    album = track.get("master_metadata_album_album_name") or ""
    played_at_raw = track.get("ts")
    ms_played = track.get("ms_played") or 0

    if not artist or not title or not played_at_raw or ms_played < 30000:
        return None

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
        return (str(user.id), artist, title, album, dt)
    except:
        return None
async def insert_tracks_in_db(valid_tracks):
    if not valid_tracks:
        return 0
    chunk_size = 1000
    inserted_count = 0
    for i in range(0, len(valid_tracks), chunk_size):
        chunk = valid_tracks[i:i + chunk_size]
        try:
            async with db_pool.acquire() as conn:
                await conn.executemany(
                    """
                    INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
                    """,
                    chunk
                )
                inserted_count += len(chunk)
                print(f"{Log.CYAN}    >>> [IMPORT PROGRESS] Inserted chunk... ({inserted_count} tracks so far in this batch){Log.RESET}")
        except Exception as e:
            print(f"Error inserting database chunk: {e}")
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
                    str(user.id), user.name
                )
        except Exception as e:
            print(f"Error ensuring imported_user: {e}")

        # Parse and process
        if not is_zip:
            # Process single JSON file from disk using our zero-RAM streaming parser
            valid_tracks = []
            with open(temp_filepath, "r", encoding="utf-8", errors="ignore") as f:
                for track in stream_parse_spotify_json(f):
                    parsed = parse_single_spotify_track(user, track)
                    if parsed:
                        valid_tracks.append(parsed)
                    
                    if len(valid_tracks) >= 1000:
                        processed_count += await insert_tracks_in_db(valid_tracks)
                        valid_tracks.clear()
                        gc.collect()
            
            if valid_tracks:
                processed_count += await insert_tracks_in_db(valid_tracks)
                valid_tracks.clear()
                gc.collect()
        else:
            # Process ZIP file entry by entry from disk using our zero-RAM streaming parser
            with zipfile.ZipFile(temp_filepath) as z:
                # fmbot logic: Reject Account Data packages which contain Userdata and lack album names
                if any("userdata" in name.lower() for name in z.namelist()):
                    try:
                        os.remove(temp_filepath)
                    except: pass
                    
                    embed = discord.Embed(
                        title="❌ Invalid Export Package",
                        description="You uploaded the **Account Data** package, which is missing album names and contains duplicates.\\n\\nPlease go to Spotify Privacy settings and request the **Extended streaming history** instead.",
                        color=discord.Color.red(),
                        timestamp=datetime.now()
                    )
                    await user.send(embed=embed)
                    return

                for filename in z.namelist():
                    if filename.endswith(".json") and any(x in filename for x in ["StreamingHistory", "endsong", "Streaming_History"]):
                        try:
                            valid_tracks = []
                            with z.open(filename) as f:
                                # Wrap binary stream in a TextIOWrapper so we can stream characters
                                text_stream = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
                                for track in stream_parse_spotify_json(text_stream):
                                    parsed = parse_single_spotify_track(user, track)
                                    if parsed:
                                        valid_tracks.append(parsed)
                                    
                                    if len(valid_tracks) >= 1000:
                                        processed_count += await insert_tracks_in_db(valid_tracks)
                                        valid_tracks.clear()
                                        gc.collect()
                            
                            if valid_tracks:
                                processed_count += await insert_tracks_in_db(valid_tracks)
                                valid_tracks.clear()
                                gc.collect()
                                
                        except Exception as e:
                            print(f"Error processing {filename} inside zip: {e}")

        # Delete temp file
        try:
            os.remove(temp_filepath)
        except: pass

        # Send DM when finished
        embed = discord.Embed(
            title="✅ Spotify Import Complete!",
            description=(
                f"Hey **{user.display_name}**, your Spotify history has finished importing!\n\n"
                f"• **{processed_count:,}** tracks processed successfully.\n\n"
                f"You can now use bot commands like `/profile` or `/topartists`!"
            ),
            color=0x2ecc71,
            timestamp=datetime.now()
        )
        await user.send(embed=embed)

    except Exception as e:
        print(f"Error in background import process: {e}")
        try:
            os.remove(temp_filepath)
        except: pass
        try:
            await user.send(f"❌ An error occurred during the background import of your Spotify data: {e}")
        except: pass
async def handle_discord_import(user, attachment, response_target):
    try:
        is_zip = attachment.filename.endswith(".zip")
        temp_filepath = f"temp_import_{user.id}_{attachment.id}.{'zip' if is_zip else 'json'}"
        
        # Save attachment directly to disk in streamed mode
        await attachment.save(temp_filepath)
        
        # Add to import queue instead of processing immediately
        await import_queue.put((user, temp_filepath, is_zip, response_target))
        queue_pos = import_queue.qsize()
        
        await response_target(f"✅ File received successfully! You are currently position **#{queue_pos}** in the import queue. The bot will process your history in the background and DM you when finished.")
    except Exception as e:
        print(f"Error in handle_discord_import saving file: {e}")
        await response_target("❌ An error occurred while receiving your file.")
async def handle_discord_import_link(user, link, response_target):
    try:
        is_zip = link.lower().endswith(".zip") or "zip" in link.lower()
        temp_filepath = f"temp_import_{user.id}_link.{'zip' if is_zip else 'json'}"
        
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
        print(f"Error in handle_discord_import_link: {e}")
        await response_target("❌ An error occurred while downloading or processing the link.")
import_queue = asyncio.Queue()

async def import_worker():
    while True:
        user, temp_filepath, is_zip, response_target = await import_queue.get()
        print(f"{Log.CYAN}>>> [IMPORT QUEUE] Starting import for {user.name} ({user.id}). Items left in queue: {import_queue.qsize()}{Log.RESET}")
        try:
            await process_discord_import_in_background(user, temp_filepath, is_zip, response_target)
        except Exception as e:
            print(f"{Log.RED}>>> [IMPORT QUEUE] Error processing import for {user.name}: {e}{Log.RESET}")
        finally:
            import_queue.task_done()
            print(f"{Log.GREEN}>>> [IMPORT QUEUE] Finished import task for {user.name}.{Log.RESET}")



@bot.event
async def on_ready():
    print(f"{Log.CYAN}----------------------------------------{Log.RESET}")
    print(f"{Log.CYAN}The Goats Dj is online as {bot.user}!{Log.RESET}")
    total_servers = len(bot.guilds)
    total_members = sum(g.member_count for g in bot.guilds if g.member_count)
    print(f"{Log.GREEN}>>> Connected to {total_servers} servers with {total_members} total members!{Log.RESET}")
    print(f"{Log.YELLOW}>>> NOTE: Slash commands no longer auto-sync on boot.{Log.RESET}")
    print(f"{Log.YELLOW}>>> Type ,sync in Discord to update commands.{Log.RESET}")
    print(f"{Log.CYAN}----------------------------------------{Log.RESET}")
    
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
    


@bot.event
async def on_guild_join(guild):
    print(f"{Log.GREEN}>>> JOINED GUILD: {guild.name} ({guild.id}) - {guild.member_count} members{Log.RESET}")
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = discord.Embed(
            title="📥 Joined New Server!",
            description=f"**Name:** {guild.name}\n**ID:** `{guild.id}`\n**Members:** {guild.member_count}\n**Owner:** {guild.owner if guild.owner else 'Unknown'}",
            color=discord.Color.green()
        )
        if guild.icon: embed.set_thumbnail(url=guild.icon.url)
        await owner.send(embed=embed)
    except Exception as e: print(f"{Log.RED}>>> Failed to notify owner of guild join: {e}{Log.RESET}")

@bot.event
async def on_guild_remove(guild):
    print(f"{Log.RED}>>> LEFT GUILD: {guild.name} ({guild.id}){Log.RESET}")
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = discord.Embed(
            title="📤 Left Server",
            description=f"**Name:** {guild.name}\n**ID:** `{guild.id}`",
            color=discord.Color.red()
        )
        if guild.icon: embed.set_thumbnail(url=guild.icon.url)
        await owner.send(embed=embed)
    except Exception as e: print(f"{Log.RED}>>> Failed to notify owner of guild leave: {e}{Log.RESET}")

# --- HELPER: ERROR DM ---
async def notify_owner(ctx, err):
    print(f"{Log.RED}>>> ERROR in {ctx}: {err}{Log.RESET}")
    try:
        await bot.wait_until_ready()
        owner = await bot.fetch_user(OWNER_ID)
        tick = chr(96)
        code_block = tick + tick + tick
        msg_lines = [f"An error occurred in **{str(ctx)}**:", f"{code_block}py", str(err)[:1800], code_block]
        embed = discord.Embed(title="⚠️ Bot Error", description=chr(10).join(msg_lines), color=discord.Color.red())
        await owner.send(embed=embed)
    except Exception as e: print(f"{Log.RED}>>> FAILED to notify owner: {e}{Log.RESET}")

@bot.event
async def on_command(ctx):
    location = f"Server: {ctx.guild.name} | Channel: #{ctx.channel.name}" if ctx.guild else "DM"
    print(f"{Log.CYAN}>>> [PREFIX COMMAND] {ctx.author} ran '{ctx.message.content}' in {location}{Log.RESET}")

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound): return
    await notify_owner(f"{ctx.prefix}{ctx.invoked_with}", error)
    try: await ctx.send("Whoops! Error notified.")
    except: pass

@bot.tree.error
async def on_app_command_error_tree(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    cmd_name = interaction.command.name if interaction.command else "unknown"
    await notify_owner(f"/{cmd_name}", error)
    if not interaction.response.is_done(): 
        try: await interaction.response.send_message("Whoops! Error notified.", ephemeral=True)
        except: pass

@bot.event
async def on_app_command_completion(interaction: discord.Interaction, command: discord.app_commands.Command | discord.app_commands.ContextMenu):
    location = f"Server: {interaction.guild.name} | Channel: #{interaction.channel.name}" if interaction.guild else "DM"
    print(f"{Log.CYAN}>>> [SLASH COMMAND] {interaction.user} ran '/{command.name}' in {location}{Log.RESET}")
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

# --- HELPER: AVATAR & STATUS CHANGER ---
async def update_bot_avatar_and_status(bot_instance, artist, image_url):
    global db_pool
    try:
        if bot_instance.activity and bot_instance.activity.name == artist:
            return False, 0
    except: pass

    if not image_url: return False, 0
    now = datetime.utcnow()
    
    # Check cooldown in Postgres
    if db_pool:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'avatar_cooldown'")
            if row and row['value']:
                try:
                    last_update = datetime.fromisoformat(row['value'])
                    diff = (now - last_update).total_seconds()
                    if diff < 300:
                        return False, int(300 - diff)
                except: pass

    session = getattr(bot_instance, 'session', None)
    local_session = False
    if session is None:
        session = aiohttp.ClientSession()
        local_session = True

    try:
        async with session.get(image_url) as resp:
            if resp.status == 200:
                image_data = await resp.read()
                await bot_instance.user.edit(avatar=image_data)
                await bot_instance.change_presence(activity=discord.Activity(type=discord.ActivityType.listening, name=artist))
                
                # Update cooldown and status in Postgres
                if db_pool:
                    async with db_pool.acquire() as conn:
                        await conn.execute(
                            "INSERT INTO global_settings (key, value) VALUES ('avatar_cooldown', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                            now.isoformat()
                        )
                        await conn.execute(
                            "INSERT INTO global_settings (key, value) VALUES ('bot_status', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                            artist
                        )
                return True, 300
    except Exception as e:
        print(f"{Log.RED}>>> Failed to update avatar/status: {e}{Log.RESET}")
    finally:
        if local_session:
            await session.close()
    return False, 0


async def add_custom_reactions(message):
    try:
        await message.add_reaction("<a:mc_Fire:1423825520516141138>")
        await message.add_reaction("<a:Jamming:1441565477313970259>")
    except: pass

# --- HELPER: DATABASE MANAGEMENT ---
def load_users():
    return json.load(open(USERS_FILE)) if os.path.exists(USERS_FILE) else {}

async def save_user(uid, username):
    global db_pool
    if not db_pool:
        print(f"{Log.RED}>>> No database connection available to save user!{Log.RESET}")
        return
    async with db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO user_settings (user_id, lastfm_username) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username",
            str(uid), username
        )
    print(f"{Log.CYAN}>>> Saved Last.fm user to Postgres: {username} ({uid}){Log.RESET}")

async def get_lastfm_username(uid):
    global db_pool
    if not db_pool: return None
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT lastfm_username FROM user_settings WHERE user_id = $1", str(uid))
        return row['lastfm_username'] if row and row['lastfm_username'] else None

# --- LAST.FM API FETCHERS ---


class MoreInfoView(discord.ui.View):
    def __init__(self, embed: discord.Embed):
        super().__init__(timeout=None)
        self.embed = embed

    @discord.ui.button(label="More info", style=discord.ButtonStyle.secondary)
    async def more_info(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(embed=self.embed, ephemeral=True)

async def get_settings_embed(user_id, user):
    mode = await get_user_fm_mode(user_id)
    feats = await get_user_show_features(user_id)
    d_source = await get_user_data_source(user_id)
    embed = discord.Embed(title=f"⚙️ Settings for {user.display_name}", color=LASTFM_COLOR)
    embed.add_field(name="/fm Display Mode", value=f"`{mode}`", inline=True)
    embed.add_field(name="Featured Artists", value=f"`{'ON' if feats else 'OFF'}`", inline=True)
    
    source_label = "Imported Only" if d_source == 'imported_only' else "Last.fm + Imported"
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
        super().__init__(placeholder="Select a setting to change...", min_values=1, max_values=1, options=options)

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

async def apply_features(session, artist, song):
    import re
    m = re.search(r"[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\]\)]+)[\)\]]", song, flags=re.IGNORECASE)
    if m:
        features = m.group(1).strip()
        song = song.replace(m.group(0), "").strip()
        return f"{artist}, {features}", song
    
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(artist + ' ' + song)}&entity=song&limit=1"
        async with session.get(url) as r:
            if r.status == 200:
                data = await r.json()
                if data.get('resultCount', 0) > 0:
                    it_artist = data['results'][0].get('artistName', '')
                    it_track = data['results'][0].get('trackName', '')
                    
                    m2 = re.search(r"[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\]\)]+)[\)\]]", it_track, flags=re.IGNORECASE)
                    if m2:
                        features = m2.group(1).strip()
                        return f"{artist}, {features}", song
                    elif it_artist.lower() != artist.lower() and ('&' in it_artist or ',' in it_artist or 'feat' in it_artist.lower()):
                        return it_artist, song
    except Exception:
        pass
        
    return artist, song

# --- CORE LOGIC ---
import discord
from datetime import datetime, timedelta



async def process_fm(ctx_int, user, mode="full"):
    bot_instance = getattr(ctx_int, 'client', getattr(ctx_int, 'bot', bot))
    session = getattr(bot_instance, 'session', None)

    username = await get_lastfm_username(user.id)
    if not username: return None, "Link Last.fm with `/setfm [username]`"
    
    data = await fetch_now_playing(username, 2 if mode == 'stats' else 1)
    if not data or 'recenttracks' not in data or not data['recenttracks']['track']: 
        return None, "Could not find recent tracks."
    
    try:
        tracks = data['recenttracks']['track']
        t = tracks[0]
        artist, song, album, img = t['artist']['#text'], t['name'], t['album']['#text'], t['image'][3]['#text']
        
        show_features = await get_user_show_features(user.id)
        if show_features:
            artist, song = await apply_features(session, artist, song)
                
        track_url = t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(artist)}/_/{urllib.parse.quote(song)}")
        is_p = t.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_p else "Last Played"
        color = LASTFM_COLOR if is_p else discord.Color.dark_gray()

        changed, cd = await update_bot_avatar_and_status(bot_instance, artist, img) if is_p else (False, 0)

        if mode == "compact":
            if is_p:
                content = f"<a:movingnotes:1476084305229910159> **{user.display_name}** is listening to **[{song}](<{track_url}>)** by **{artist}**"
            else:
                content = f"🎧 **{user.display_name}** was listening to **[{song}](<{track_url}>)** by **{artist}**"
            
            desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
            embed = discord.Embed(description=desc, color=color)
            embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
            if img: embed.set_thumbnail(url=img)
            
            footer_text = f"Scrobbling as {username}"
            if cd > 0:
                m, s = divmod(int(cd), 60)
                footer_text += f" • Avatar CD: {m}m {s}s"
                
            embed.set_footer(text=footer_text)
            return {"content": content, "view": MoreInfoView(embed)}, is_p

        if mode == "stats":
            desc_lines = [f"**[{song}]({track_url})**", f"**{artist}** • *{album}*"]
            
            if len(tracks) > 1:
                prev_t = tracks[1]
                p_artist, p_song, p_album = prev_t['artist']['#text'], prev_t['name'], prev_t['album']['#text']
                
                if show_features:
                    p_artist, p_song = await apply_features(session, p_artist, p_song)
                
                p_url = prev_t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(p_artist)}/_/{urllib.parse.quote(p_song)}")
                desc_lines.extend(["", "Previous:", f"**[{p_song}]({p_url})**", f"**{p_artist}** • *{p_album}*"])
            
            embed = discord.Embed(description=chr(10).join(desc_lines), color=color)
            embed.set_author(name=f"Now playing for {user.display_name}" if is_p else f"Last played by {user.display_name}")
            if img: embed.set_thumbnail(url=img)
            
            t_info_task = asyncio.create_task(fetch_track_info(username, artist, song))
            a_info_task = asyncio.create_task(fetch_artist_info(username, artist))
            
            guild = getattr(ctx_int, 'guild', None)
            crown_task = None
            if guild:
                users_db = load_users()
                linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
                if linked:
                    async def fetch_crown():
                        tasks = [(uid, lname, fetch_artist_playcount(session, lname, artist)) for uid, lname in linked.items()]
                        results = await asyncio.gather(*(t[2] for t in tasks))
                        lb = [{"name": guild.get_member(int(tasks[i][0])).display_name if guild.get_member(int(tasks[i][0])) else tasks[i][1], "plays": pc} for i, pc in enumerate(results) if pc > 0]
                        if not lb: return None
                        lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
                        return lb[0]
                    crown_task = asyncio.create_task(fetch_crown())
            
            t_info = await t_info_task
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
                
            embed.set_footer(text=chr(10).join(footer_parts) if footer_parts else f"Scrobbling as {username}")
            return {"embed": embed}, is_p

        desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
        embed = discord.Embed(description=desc, color=color)
        embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
        if img: embed.set_thumbnail(url=img)
        
        footer_text = f"Scrobbling as {username}"
        if cd > 0:
            mins, secs = divmod(cd, 60)
            footer_text += f" • Avatar CD: {mins}m {secs}s"
        embed.set_footer(text=footer_text)
        
        return {"embed": embed}, is_p
    except Exception as e: 
        print(f"{Log.RED}>>> parsing error: {e}{Log.RESET}")
        return None, "Error formatting track."
async def process_top_artists(user, input_period=None):
    username = await get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)
    
    d_source = await get_user_data_source(user.id)


    lastfm_data = {}
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        if api_p.isdigit() and len(api_p) == 4:
            reg_datetime = None # Can't fetch Last.fm data for specific years, so don't deduplicate
        else:
            data = await fetch_top_artists(username, api_p, 250)
            if data and 'topartists' in data:
                lastfm_data = {a['name']: int(a['playcount']) for a in data['topartists']['artist']}

    local_data = await get_local_top_artists(user.id, 250, api_p, before_dt=reg_datetime)

    if not username and not local_data:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_data)
    for artist, count in local_data.items():
        combined[artist] = combined.get(artist, 0) + count

    sorted_artists = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_artists: return None, "No artist data found."

    lines = [f"{get_medal(idx)} **{name}** — **{count:,}** plays" for idx, (name, count) in enumerate(sorted_artists)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Top Artists ({disp_p})", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    if username:
        embed.set_footer(text=f"Scrobbling as {username}")
    else:
        embed.set_footer(text="Using Imported Data")
    return embed, None
async def process_top_tracks(user, input_period=None):
    username = await get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    d_source = await get_user_data_source(user.id)


    lastfm_tracks = {}  # (track, artist) -> plays
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        if api_p.isdigit() and len(api_p) == 4:
            reg_datetime = None # Can't fetch Last.fm data for specific years, so don't deduplicate
        else:
            data = await fetch_top_tracks(username, api_p, 250)
            if data and 'toptracks' in data:
                for t in data['toptracks']['track']:
                    key = (t['name'], t['artist']['name'])
                    lastfm_tracks[key] = int(t['playcount'])

    local_tracks = await get_local_top_tracks(user.id, 250, api_p, before_dt=reg_datetime)

    if not username and not local_tracks:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_tracks)
    for track_name, artist_name, plays in local_tracks:
        key = (track_name, artist_name)
        combined[key] = combined.get(key, 0) + plays

    sorted_tracks = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_tracks: return None, "No track data found."

    lines = [f"{get_medal(idx)} **{t}** by {a} — **{c:,}** plays" for idx, ((t, a), c) in enumerate(sorted_tracks)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Top Tracks ({disp_p})", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    if username:
        embed.set_footer(text=f"Scrobbling as {username}")
    else:
        embed.set_footer(text="Using Imported Data")
    return embed, None

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

        lines = [f"`{start + idx + 1}.` **{t}** - {c:,} plays" for idx, (t, c) in enumerate(page_tracks)]
        
        embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
        embed.set_author(name=f"Your top tracks for '{self.artist_name}'", icon_url=self.user.display_avatar.url)
        
        footer_text = f"Page {self.current_page + 1}/{self.max_pages} — {len(self.sorted_tracks)} different tracks\n{self.user.display_name} has {self.total_plays:,} total artist plays"
        embed.set_footer(text=footer_text)
        return embed

    @discord.ui.button(label="<", style=discord.ButtonStyle.secondary, custom_id="prev")
    async def prev_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            return await interaction.response.send_message("This isn't your menu!", ephemeral=True)
        self.current_page -= 1
        self.update_buttons()
        await interaction.response.edit_message(embed=self.generate_embed(), view=self)

    @discord.ui.button(label=">", style=discord.ButtonStyle.secondary, custom_id="next")
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
        if not username: return None, None, "Link account or provide an artist name."
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return None, None, "You aren't playing anything right now and didn't provide an artist!"

    lastfm_tracks = {}
    reg_datetime = None
    if username:
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        tracks = await fetch_user_artist_tracks_lastfm(username, artist_name)
        for t_name, playcount in tracks:
            lastfm_tracks[t_name] = playcount

    local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=reg_datetime)

    if not username and not local_tracks:
        return None, None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_tracks)
    for track_name, plays in local_tracks:
        combined[track_name] = combined.get(track_name, 0) + plays

    sorted_tracks = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    if not sorted_tracks: return None, None, f"No track data found for **{artist_name}**."

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
    if username:
        data = await fetch_now_playing(username, 10)
        if data:
            lines = [f"{'🎶' if i == 0 and t.get('@attr', {}).get('nowplaying') == 'true' else f'` {i+1}. `'} **{t['name']}** by {t['artist']['#text']}" for i, t in enumerate(data['recenttracks']['track'][:10])]
            embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{user.display_name}'s Recent Tracks", icon_url=user.display_avatar.url)
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.set_footer(text=f"Scrobbling as {username}")
            return embed, None
    # Fallback to local DB
    local = await get_local_recent_tracks(user.id, 10)
    if not local: return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
    lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {user.display_name} • Using Imported Data", icon_url=user.display_avatar.url)
    return embed, None

async def process_judge(user):
    username = await get_lastfm_username(user.id)
    
    # 1. Gather Top 14 Artists
    artists_dict = {}
    if username:
        data = await fetch_top_artists(username, 'overall', 50)
        if data and 'topartists' in data:
            for a in data['topartists']['artist']:
                artists_dict[a['name']] = int(a['playcount'])
    
    local_artists = await get_local_top_artists(user.id, 50, 'overall')
    for a, c in local_artists.items():
        artists_dict[a] = artists_dict.get(a, 0) + c
        
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
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal to use the AI Judge."

    # Format the data exactly like fmbot
    artist_lines = [f"{a[:40]} - {c} plays" for a, c in top_artists]
    track_lines = [f"{t[:50]} by {a[:40]} - {c} plays" for (t, a), c in top_tracks]
    
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
            return None, "Please get a free Groq API key from console.groq.com/keys and put it in your .env as GROQ_API_KEY!"

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
            async with session.post(url, headers=headers, json=payload) as resp:
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
        
        embed = discord.Embed(
            description=roast_text,
            color=0xFF7A01,
            timestamp=datetime.now()
        )
        embed.set_author(name=f"{user.display_name}'s .fmbot AI judgement - Roast 🔥", icon_url=user.display_avatar.url)
        embed.set_footer(text="Powered by Groq")
        return embed, None
    except Exception as e:
        print(f"Judge API Error: {e}")
        return None, "An error occurred while contacting the AI Judge. Try again later."

async def process_profile(user):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)

    username = await get_lastfm_username(user.id)
    local_total = await get_local_total_plays(user.id)

    d_source = await get_user_data_source(user.id)

    if not username and local_total == 0:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    embed = discord.Embed(color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Profile", icon_url=user.display_avatar.url)

    if username:
        data = await fetch_user_profile(username)
        if data:
            info = data['user']
            embed.title = f"{info['name']}'s Last.fm Profile"
            embed.url = info['url']
            lastfm_plays = int(info['playcount'])
            
            # Smart De-duplication of duplicate plays:
            # We only count imported database plays that occurred BEFORE their Last.fm registration time.
            # All plays after registration are already scrobbled and counted in lastfm_plays!
            reg_unixtime = int(info['registered']['unixtime'])
            reg_datetime = datetime.utcfromtimestamp(reg_unixtime)
            local_unique = await get_local_plays_before(user.id, reg_datetime)
            
            total = lastfm_plays + local_unique
            embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
            if local_total > 0:
                embed.add_field(name="📦 Imported Plays (Unique)", value=f"**{local_unique:,}**", inline=True)
                embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
            
            if local_total > 0:
                overlap = local_total - local_unique
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles during Last.fm overlap.")
    elif local_total > 0:
        embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
        embed.add_field(name="ℹ️ Last.fm", value="Not linked — use `/setfm`", inline=True)

    return embed, None
async def process_whoknows(guild, user, artist_name):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)
    if not guild: return None, "Must be used in a server."
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    if not artist_name:
        username = await get_lastfm_username(user.id)
        if not username: return None, "Link account or provide an artist name."
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return None, "You aren't playing anything right now!"

    lb = []
    tasks = [(uid, lname, fetch_artist_playcount(session, lname, artist_name)) for uid, lname in linked.items()]
    results = await asyncio.gather(*(t[2] for t in tasks))
    for idx, pc in enumerate(results):
        if pc > 0:
            m = guild.get_member(int(tasks[idx][0]))
            lb.append({"name": m.display_name if m else tasks[idx][1], "plays": pc})

    if not lb: return None, f"No one here listens to **{artist_name}**."
    lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
    lines = [f"{get_medal(i)} **{u['name']}** — **{u['plays']:,}** plays" for i, u in enumerate(lb[:15])]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"Who knows {artist_name} in {guild.name}?", icon_url=guild.icon.url if guild.icon else None)
    embed.set_thumbnail(url=user.display_avatar.url)
    
    footer_text = f"Requested by {user.name}"
    if lb[0]['name'] == user.display_name: footer_text = "👑 You hold the crown! • " + footer_text
    embed.set_footer(text=footer_text)
    return embed, None
async def process_suggestion(ctx_int, user, suggestion_text):
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = discord.Embed(title="💡 New Bot Suggestion", description=suggestion_text, color=discord.Color.gold(), timestamp=datetime.now())
        embed.set_author(name=f"{user.display_name} ({user.id})", icon_url=user.display_avatar.url)
        guild_name = ctx_int.guild.name if getattr(ctx_int, 'guild', None) else "DMs / User App"
        embed.set_footer(text=f"Sent from: {guild_name}")
        await owner.send(embed=embed, view=SuggestionView())
        print(f"{Log.GREEN}>>> New suggestion forwarded to owner.{Log.RESET}")
        
        confirm = discord.Embed(description="✅ Suggestion sent directly to the developer!", color=discord.Color.green())
        if isinstance(ctx_int, discord.Interaction): await ctx_int.response.send_message(embed=confirm, ephemeral=True)
        else: await ctx_int.send(embed=confirm)
    except Exception as e:
        print(f"{Log.RED}>>> Suggestion error: {e}{Log.RESET}")
async def process_crowns(guild, user):
    bot_instance = bot
    session = getattr(bot_instance, 'session', None)

    if not guild: return None, "Must be used in a server."
    username = await get_lastfm_username(user.id)
    if not username: return None, "Link your account first with `/setfm [username]`"
    
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    
    top_artists_data = await fetch_top_artists(username, 'overall', 15)
    if not top_artists_data or 'topartists' not in top_artists_data: return None, "Error fetching your top artists."
    
    artists_to_check = [a['name'] for a in top_artists_data['topartists']['artist']]
    if not artists_to_check: return None, "You don't have any artists in your history!"

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
        return None, "You don't hold any crowns for your top 15 artists in this server!"
        
    lines = [f"👑 **{artist}** — **{plays:,}** plays" for artist, plays in crowns]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Crowns in {guild.name}", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text=f"Checked your top 15 artists • Requested by {user.display_name}", icon_url=user.display_avatar.url)
    return embed, None








def get_help_embed(user):
    embed = discord.Embed(title="Bot Commands Help", color=LASTFM_COLOR, description="Here are all the available commands for The Goats Dj bot.")
    embed.add_field(name="🎧 Last.fm Commands", value=
        "`/setfm` (or `,setfm`) - Link your Last.fm username\n"
        "`/fm` (or `,fm`, `,np`) - View your currently playing track\n"
        "`/topartists` (or `,ta`) - View your top played artists\n"
        "`/toptracks` (or `,tt`) - View your top played tracks\n"
        "`/artisttracks` (or `,at`) - View your top played tracks for an artist\n"
        "`/recent` (or `,rt`) - View your recent listening history\n"
        "`/profile` (or `,s`) - View your Last.fm stats\n"
        "`/import` (or `,import`) - Upload your Spotify ZIP or JSON directly", inline=False)
    embed.add_field(name="👑 Server Stats", value=
        "`/whoknows` (or `,wk`) - See who listens to an artist most in the server\n"
        "`/crowns` (or `,crowns`) - See which of your top artists you have the most plays for in the server", inline=False)
    embed.add_field(name="💡 Other", value=
        "`/suggest` (or `,suggest`) - Send a suggestion directly to the developer\n"
        "`/deletedata` (or `,deletedata`) - Permanently delete all your database data", inline=False)
    embed.set_author(name=user.display_name, icon_url=user.display_avatar.url)
    return embed

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
                print(f"Error purging user data from DB: {e}")
        
        unlinked = False
        try:
            users = load_users()
            if str(self.user.id) in users:
                del users[str(self.user.id)]
                with open(USERS_FILE, "w") as f: json.dump(users, f)
                unlinked = True
        except Exception as e:
            print(f"Error clearing Last.fm json link: {e}")

        embed = discord.Embed(
            title="🗑️ Data Successfully Deleted",
            description=(
                f"Your data has been fully purged from the database:\n\n"
                f"• **{deleted_count:,}** imported listens deleted.\n"
                f"• Last.fm account linkage: **{'Removed' if unlinked else 'None linked'}**\n\n"
                f"All your data has been completely and permanently erased!"
            ),
            color=discord.Color.red(),
            timestamp=datetime.now()
        )
        await interaction.response.edit_message(embed=embed, view=None)

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.stop()
        embed = discord.Embed(
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
    print(f"{Log.MAGENTA}>>> [/setcustomfm] Triggered by {interaction.user.name}{Log.RESET}")
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
        
        spotify_act = None
        if getattr(message, 'interaction_metadata', None) and message.guild:
            member = message.guild.get_member(message.interaction_metadata.user.id)
            if member and member.activities:
                spotify_act = next((act for act in member.activities if isinstance(act, discord.Spotify)), None)
        elif not is_stats_bot and message.guild:
            member = message.guild.get_member(message.author.id)
            if member and member.activities:
                spotify_act = next((act for act in member.activities if isinstance(act, discord.Spotify)), None)

        if spotify_act:
            await update_bot_avatar_and_status(bot, spotify_act.artist, spotify_act.album_cover_url)

    await bot.process_commands(message)

async def process_receipt(user, period='overall', limit=10):
    from ..utils.images import generate_receipt_image
    from ..utils.api import fetch_top_tracks
    import discord
    
    username = await get_lastfm_username(user.id)
    if not username:
        return None, None, f"You have not linked your Last.fm account! Use `,setfm [username]` to link it."
        
    data = await fetch_top_tracks(username, period, limit)
    if not data or 'toptracks' not in data or not data['toptracks']['track']:
        return None, None, "Could not fetch top tracks for the receipt."
        
    tracks_raw = data['toptracks']['track']
    tracks = []
    for t in tracks_raw:
        tracks.append((t['name'], t['artist']['name'], int(t['playcount'])))
        
    buf = generate_receipt_image(username, period, tracks)
    file = discord.File(buf, filename="receipt.png")
    
    embed = discord.Embed(title=f"🧾 {user.display_name}'s Top Tracks Receipt", color=LASTFM_COLOR)
    embed.set_image(url="attachment://receipt.png")
    
    return embed, file, None


