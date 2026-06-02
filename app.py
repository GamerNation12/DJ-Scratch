import os
import discord
import aiohttp
import json
import asyncio
import urllib.parse
from discord.ext import commands
from discord import app_commands
from dotenv import load_dotenv
from datetime import datetime, timedelta
import asyncpg

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
    '3m': ('3month', 'Last 3 Months'), '6m': ('6month', 'Last 6 Months'),
    '1y': ('12month', 'Last Year'), '12m': ('12month', 'Last Year'),
    'all': ('overall', 'All Time'), 'overall': ('overall', 'All Time'),
    'at': ('overall', 'All Time')
}

def get_period_data(input_period):
    if not input_period: return 'overall', 'All Time'
    return PERIOD_MAP.get(input_period.lower(), ('overall', 'All Time'))

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
                    
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS global_settings (
                        key VARCHAR(255) PRIMARY KEY,
                        value TEXT
                    )
                    """
                )
                print(f"{Log.GREEN}>>> Ensured user_settings table exists{Log.RESET}")
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.YELLOW}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
bot.setup_hook = setup_hook

db_pool = None

async def get_user_fm_mode(user_id):
    if not db_pool:
        return 'full'
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT fm_mode FROM user_settings WHERE user_id=$1", str(user_id))
            return row['fm_mode'] if row else 'full'
    except Exception as e:
        print(f"Error fetching user fm mode: {e}")
        return 'full'

async def get_user_show_features(user_id):
    if not db_pool:
        return False
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT show_features FROM user_settings WHERE user_id=$1", str(user_id))
            return row['show_features'] if row else False
    except Exception as e:
        print(f"Error fetching user show_features: {e}")
        return False

async def set_user_fm_mode(user_id, mode):
    if not db_pool:
        return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_settings (user_id, fm_mode)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET fm_mode = EXCLUDED.fm_mode
                """,
                str(user_id), mode
            )
            return True
    except Exception as e:
        print(f"Error saving user fm mode: {e}")
        return False

async def set_user_show_features(user_id, show_features: bool):
    if not db_pool:
        return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_settings (user_id, show_features)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET show_features = EXCLUDED.show_features
                """,
                str(user_id), show_features
            )
            return True
    except Exception as e:
        print(f"Error saving user show_features: {e}")
        return False

PERIOD_TO_DAYS = {
    '7day': 7, '1month': 30, '3month': 90, '6month': 180, '12month': 365
}

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
    
    if days:
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
    
    if days:
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

@bot.tree.error
async def on_app_command_error(interaction, error):
    cmd_name = interaction.command.name if interaction.command else (interaction.data.get("name") if interaction.data else "unknown")
    await notify_owner(f"/{cmd_name}", error)
    if not interaction.response.is_done(): 
        try: await interaction.response.send_message("Whoops! Error notified.", ephemeral=True)
        except: pass

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound): return
    await notify_owner(f"{ctx.prefix}{ctx.invoked_with}", error)
    try: await ctx.send("Whoops! Error notified.")
    except: pass

# --- HELPER: AVATAR & STATUS CHANGER ---
async def update_bot_avatar_and_status(artist, image_url):
    global avatar_cooldown_time
    now = datetime.now()
    
    # Avoid changing avatar/presence if the bot is already listening to the same artist
    try:
        if bot.activity and bot.activity.name == artist:
            return False, 0
    except: pass

    # Load persistent cooldown
    if os.path.exists(COOLDOWN_FILE):
        try:
            with open(COOLDOWN_FILE, "r") as f:
                saved = datetime.fromisoformat(f.read().strip())
                if now < saved:
                    total_seconds = int((saved - now).total_seconds())
                    mins = total_seconds // 60
                    secs = total_seconds % 60
                    cd_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
                    print(f"{Log.YELLOW}>>> Skipping avatar change. Cooldown active for {cd_str}.{Log.RESET}")
                    return False, max(1, mins)
        except: pass 

    if not image_url: return False, 0
    print(f"{Log.CYAN}>>> Downloading album art for {artist}...{Log.RESET}")
    try:
        async with bot.session.get(image_url) as response:
            if response.status == 200:
                    image_bytes = await response.read()
                    await bot.user.edit(avatar=image_bytes)
                    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.listening, name=artist))
                    print(f"{Log.GREEN}>>> Bot updated status & PFP for: {artist}{Log.RESET}")
                    
                    if db_pool:
                        try:
                            async with db_pool.acquire() as conn:
                                await conn.execute(
                                    "INSERT INTO global_settings (key, value) VALUES ('current_avatar', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                                    image_url
                                )
                        except Exception as e:
                            print(f"{Log.RED}>>> Failed to update global_settings: {e}{Log.RESET}")
                    
                    cd_time = now + timedelta(minutes=10)
                    with open(COOLDOWN_FILE, "w") as f: f.write(cd_time.isoformat())
                    avatar_cooldown_time = cd_time
                    return True, 0
    except Exception as e: print(f"{Log.RED}>>> Avatar Changer Error: {e}{Log.RESET}")
    return False, 0

async def add_custom_reactions(message):
    try:
        await message.add_reaction("<a:mc_Fire:1423825520516141138>")
        await message.add_reaction("<a:Jamming:1441565477313970259>")
        print(f"{Log.GREEN}>>> Added reactions!{Log.RESET}")
    except: pass

# --- HELPER: DATABASE MANAGEMENT ---
def load_users():
    return json.load(open(USERS_FILE)) if os.path.exists(USERS_FILE) else {}

def save_user(uid, username):
    users = load_users()
    users[str(uid)] = username
    with open(USERS_FILE, "w") as f: json.dump(users, f)
    print(f"{Log.CYAN}>>> Saved Last.fm user: {username} ({uid}){Log.RESET}")

def get_lastfm_username(uid):
    return load_users().get(str(uid))

# --- LAST.FM API FETCHERS ---
async def api_get(url):
    async with bot.session.get(url) as r:
        return await r.json() if r.status == 200 else None

async def fetch_now_playing(u, l=1): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}")
async def fetch_top_artists(u, p='overall', l=10): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}&period={p}")
async def fetch_top_tracks(u, p='overall', l=10): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user={u}&api_key={LASTFM_API_KEY}&format=json&limit={l}&period={p}")
async def fetch_user_profile(u): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_track_info(u, artist, track): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=track.getinfo&artist={urllib.parse.quote(artist)}&track={urllib.parse.quote(track)}&username={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_artist_info(u, artist): return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={urllib.parse.quote(artist)}&username={u}&api_key={LASTFM_API_KEY}&format=json")
async def fetch_artist_playcount(session, u, artist):
    async with session.get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={urllib.parse.quote(artist)}&username={u}&api_key={LASTFM_API_KEY}&format=json") as r:
        if r.status == 200:
            d = await r.json()
            return int(d['artist']['stats']['userplaycount']) if 'artist' in d else 0
    return 0

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
    embed = discord.Embed(title=f"⚙️ Settings for {user.display_name}", color=LASTFM_COLOR)
    embed.add_field(name="/fm Display Mode", value=f"`{mode}`", inline=True)
    embed.add_field(name="Featured Artists", value=f"`{'ON' if feats else 'OFF'}`", inline=True)
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
async def process_fm(ctx_int, user, mode="full"):
    username = get_lastfm_username(user.id)
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
            artist, song = await apply_features(bot.session, artist, song)
                
        track_url = t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(artist)}/_/{urllib.parse.quote(song)}")
        is_p = t.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_p else "Last Played"
        color = LASTFM_COLOR if is_p else discord.Color.dark_gray()

        changed, cd = await update_bot_avatar_and_status(artist, img) if is_p else (False, 0)

        if mode == "compact":
            if is_p:
                content = f"<a:movingnotes:1476084305229910159> **{user.display_name}** is listening to **[{song}](<{track_url}>)** by **{artist}**"
            else:
                content = f"🎧 **{user.display_name}** was listening to **[{song}](<{track_url}>)** by **{artist}**"
            
            desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
            embed = discord.Embed(description=desc, color=color)
            embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
            if img: embed.set_thumbnail(url=img)
            embed.set_footer(text=f"Scrobbling as {username}")
            return {"content": content, "view": MoreInfoView(embed)}, is_p

        if mode == "stats":
            desc_lines = [f"**[{song}]({track_url})**", f"**{artist}** • *{album}*"]
            
            if len(tracks) > 1:
                prev_t = tracks[1]
                p_artist, p_song, p_album = prev_t['artist']['#text'], prev_t['name'], prev_t['album']['#text']
                
                if show_features:
                    p_artist, p_song = await apply_features(bot.session, p_artist, p_song)
                
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
                        tasks = [(uid, lname, fetch_artist_playcount(bot.session, lname, artist)) for uid, lname in linked.items()]
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
        if cd > 0: footer_text += f" • Avatar CD: {cd}m"
        embed.set_footer(text=footer_text)
        
        return {"embed": embed}, is_p
    except Exception as e: 
        print(f"{Log.RED}>>> parsing error: {e}{Log.RESET}")
        return None, "Error formatting track."

async def process_top_artists(user, input_period=None):
    username = get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    lastfm_data = {}
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        data = await fetch_top_artists(username, api_p)
        if data and 'topartists' in data:
            lastfm_data = {a['name']: int(a['playcount']) for a in data['topartists']['artist']}

    local_data = await get_local_top_artists(user.id, 50, api_p, before_dt=reg_datetime)

    if not username and not local_data:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_data)
    for artist, count in local_data.items():
        combined[artist] = combined.get(artist, 0) + count

    sorted_artists = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_artists: return None, "No artist data found."

    lines = [f"{get_medal(idx)} **{name}** — **{count:,}** plays" for idx, (name, count) in enumerate(sorted_artists)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    db_note = " *(Last.fm + Imported)*" if local_data else ""
    embed.set_author(name=f"{user.display_name}'s Top Artists ({disp_p}){db_note}", icon_url=user.display_avatar.url)
    return embed, None

async def process_top_tracks(user, input_period=None):
    username = get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    lastfm_tracks = {}  # (track, artist) -> plays
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        data = await fetch_top_tracks(username, api_p)
        if data and 'toptracks' in data:
            for t in data['toptracks']['track']:
                key = (t['name'], t['artist']['name'])
                lastfm_tracks[key] = int(t['playcount'])

    local_tracks = await get_local_top_tracks(user.id, 50, api_p, before_dt=reg_datetime)

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
    db_note = " *(Last.fm + Imported)*" if local_tracks else ""
    embed.set_author(name=f"{user.display_name}'s Top Tracks ({disp_p}){db_note}", icon_url=user.display_avatar.url)
    return embed, None

async def process_recent(user):
    username = get_lastfm_username(user.id)
    if username:
        data = await fetch_now_playing(username, 10)
        if data:
            lines = [f"{'🎶' if i == 0 and t.get('@attr', {}).get('nowplaying') == 'true' else f'` {i+1}. `'} **{t['name']}** by {t['artist']['#text']}" for i, t in enumerate(data['recenttracks']['track'][:10])]
            embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{user.display_name}'s Recent Tracks", icon_url=user.display_avatar.url)
            return embed, None
    # Fallback to local DB
    local = await get_local_recent_tracks(user.id, 10)
    if not local: return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
    lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
    return embed, None

async def process_profile(user):
    username = get_lastfm_username(user.id)
    local_total = await get_local_total_plays(user.id)

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
    if not guild: return None, "Must be used in a server."
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    if not artist_name:
        username = get_lastfm_username(user.id)
        if not username: return None, "Link account or provide an artist name."
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return None, "You aren't playing anything right now!"

    lb = []
    tasks = [(uid, lname, fetch_artist_playcount(bot.session, lname, artist_name)) for uid, lname in linked.items()]
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
    if not guild: return None, "Must be used in a server."
    username = get_lastfm_username(user.id)
    if not username: return None, "Link your account first with `/setfm [username]`"
    
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    
    top_artists_data = await fetch_top_artists(username, 'overall', 15)
    if not top_artists_data or 'topartists' not in top_artists_data: return None, "Error fetching your top artists."
    
    artists_to_check = [a['name'] for a in top_artists_data['topartists']['artist']]
    if not artists_to_check: return None, "You don't have any artists in your history!"

    async def check_artist(artist):
        tasks = [(uid, fetch_artist_playcount(bot.session, lname, artist)) for uid, lname in linked.items()]
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
    embed.set_footer(text=f"Checked your top 15 artists")
    return embed, None

def get_help_embed(user):
    embed = discord.Embed(title="Bot Commands Help", color=LASTFM_COLOR, description="Here are all the available commands for The Goats Dj bot.")
    embed.add_field(name="🎧 Last.fm Commands", value=
        "`/setfm` (or `,setfm`) - Link your Last.fm username\n"
        "`/fm` (or `,fm`, `,np`) - View your currently playing track\n"
        "`/topartists` (or `,ta`) - View your top played artists\n"
        "`/toptracks` (or `,tt`) - View your top played tracks\n"
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
@bot.command(name="sync")
async def sync_commands(ctx):
    if ctx.author.id != OWNER_ID: return
    msg = await ctx.send("Syncing slash commands globally... (This may take a moment)")
    try:
        synced = await bot.tree.sync()
        await msg.edit(content=f"✅ Synced {len(synced)} slash commands globally!")
        print(f"{Log.GREEN}>>> Owner synced {len(synced)} slash commands.{Log.RESET}")
    except Exception as e:
        await msg.edit(content=f"❌ Sync failed: {e}")

@bot.command(name="stats", aliases=["guilds", "servers"])
async def stats_command(ctx):
    if ctx.author.id != OWNER_ID: return
    
    guilds = sorted(bot.guilds, key=lambda g: g.member_count or 0, reverse=True)
    total_servers = len(guilds)
    total_members = sum(g.member_count for g in guilds if g.member_count)
    
    desc_lines = []
    for idx, guild in enumerate(guilds[:25], 1):
        desc_lines.append(f"**{idx}. {guild.name}**\n   └ ID: `{guild.id}` | Members: **{guild.member_count}**")
        
    if len(guilds) > 25:
        desc_lines.append(f"\n*...and {len(guilds) - 25} more servers.*")
        
    embed = discord.Embed(
        title="📊 Bot Server Usage Statistics",
        description=chr(10).join(desc_lines) if desc_lines else "Currently not in any servers.",
        color=discord.Color.blue()
    )
    embed.add_field(name="Total Servers", value=f"`{total_servers}`", inline=True)
    embed.add_field(name="Total Reach", value=f"`{total_members}` members", inline=True)
    
    await ctx.send(embed=embed)

@bot.command(name="cleanduplicates")
async def clean_duplicates_command(ctx):
    if ctx.author.id != OWNER_ID: return
    msg = await ctx.send("🧹 Scanning database for bugged 'Account Data' duplicates (empty album names)...")
    try:
        if not db_pool:
            await msg.edit(content="❌ Database is currently offline.")
            return
            
        async with db_pool.acquire() as conn:
            result = await conn.execute("DELETE FROM listens WHERE album_name = '' OR album_name IS NULL")
            deleted_count = result.split()[-1] if result.startswith("DELETE") else "unknown number of"
            
        await msg.edit(content=f"✅ Successfully deleted **{deleted_count}** bugged duplicate entries! Users should re-import their Extended Streaming History if their plays are missing.")
        print(f"{Log.GREEN}>>> Owner cleared {deleted_count} bugged duplicates.{Log.RESET}")
    except Exception as e:
        await msg.edit(content=f"❌ Failed to clean duplicates: {e}")

# --- SLASH COMMANDS ---
@bot.tree.command(name="setfm", description="Link your Last.fm username to the bot")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def setfm_slash(interaction: discord.Interaction, username: str):
    user_name = username.replace("https://www.last.fm/user/", "").replace("/", "").strip()
    save_user(interaction.user.id, user_name)
    await interaction.response.send_message(f"✅ Linked your Discord to Last.fm account: **{user_name}**", ephemeral=True)

@bot.tree.command(name="fm", description="View what you are currently listening to")
@app_commands.describe(mode="Choose embed style")
@app_commands.choices(mode=[
    app_commands.Choice(name="Full Embed", value="full"),
    app_commands.Choice(name="Compact (1 line)", value="compact"),
    app_commands.Choice(name="Stats (Detailed)", value="stats"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def fm_slash(interaction: discord.Interaction, mode: app_commands.Choice[str] = None):
    print(f"{Log.MAGENTA}>>> [/fm] Triggered by {interaction.user.name}{Log.RESET}")
    if mode is not None:
        m = mode.value
    else:
        m = await get_user_fm_mode(interaction.user.id)
        if not m: m = "full"
    await interaction.response.defer()
    result, is_p = await process_fm(interaction, interaction.user, mode=m)
    if result is None:
        await interaction.followup.send(is_p)
    elif isinstance(result, dict):
        msg = await interaction.followup.send(wait=True, **result)
        if is_p: await add_custom_reactions(msg)

@bot.tree.command(name="topartists", description="View your top played artists")
@app_commands.describe(period="The time frame to check")
@app_commands.choices(period=[
    app_commands.Choice(name="7 Days", value="7d"), app_commands.Choice(name="1 Month", value="1m"),
    app_commands.Choice(name="3 Months", value="3m"), app_commands.Choice(name="6 Months", value="6m"),
    app_commands.Choice(name="1 Year", value="1y"), app_commands.Choice(name="All Time", value="all"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def ta_slash(interaction: discord.Interaction, period: app_commands.Choice[str] = None):
    print(f"{Log.MAGENTA}>>> [/topartists] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_top_artists(interaction.user, period.value if period else 'all')
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="toptracks", description="View your top played tracks")
@app_commands.describe(period="The time frame to check")
@app_commands.choices(period=[
    app_commands.Choice(name="7 Days", value="7d"), app_commands.Choice(name="1 Month", value="1m"),
    app_commands.Choice(name="3 Months", value="3m"), app_commands.Choice(name="6 Months", value="6m"),
    app_commands.Choice(name="1 Year", value="1y"), app_commands.Choice(name="All Time", value="all"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def tt_slash(interaction: discord.Interaction, period: app_commands.Choice[str] = None):
    print(f"{Log.MAGENTA}>>> [/toptracks] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_top_tracks(interaction.user, period.value if period else 'all')
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="recent", description="View your recent listening history")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def rt_slash(interaction: discord.Interaction):
    print(f"{Log.MAGENTA}>>> [/recent] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_recent(interaction.user)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="profile", description="View your Last.fm stats")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def profile_slash(interaction: discord.Interaction):
    print(f"{Log.MAGENTA}>>> [/profile] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_profile(interaction.user)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="whoknows", description="See who in the server listens to an artist most")
@app_commands.allowed_installs(guilds=True, users=False) 
@app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
async def wk_slash(interaction: discord.Interaction, artist: str = None):
    print(f"{Log.MAGENTA}>>> [/whoknows] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_whoknows(interaction.guild, interaction.user, artist)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="suggest", description="Send a suggestion directly to the developer")
@app_commands.describe(suggestion="Your idea or feedback for the bot")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def suggest_slash(interaction: discord.Interaction, suggestion: str):
    await process_suggestion(interaction, interaction.user, suggestion)

@bot.tree.command(name="help", description="View all available commands")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def help_slash(interaction: discord.Interaction):
    await interaction.response.send_message(embed=get_help_embed(interaction.user))

@bot.tree.command(name="crowns", description="See which of your top artists you have the most plays for")
@app_commands.allowed_installs(guilds=True, users=False) 
@app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
async def crowns_slash(interaction: discord.Interaction):
    print(f"{Log.MAGENTA}>>> [/crowns] Triggered by {interaction.user.name}{Log.RESET}")
    await interaction.response.defer()
    embed, err = await process_crowns(interaction.guild, interaction.user)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)


# --- PREFIX COMMAND ---
@bot.command(name="settings")
async def settings_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: settings] Triggered by {ctx.author.name}{Log.RESET}")
    embed = await get_settings_embed(ctx.author.id, ctx.author)
    await ctx.send(embed=embed, view=SettingsView())

@bot.command(name="fm", aliases=["np", "nowplaying", "fm1", "fm2", "fm3", "np1", "np2", "np3"])
async def fm_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: fm] Triggered by {ctx.author.name}{Log.RESET}")
    invoked = ctx.invoked_with
    if invoked in ["fm1", "np1"]:
        m = "compact"
    elif invoked in ["fm2", "np2"]:
        m = "full"
    elif invoked in ["fm3", "np3"]:
        m = "stats"
    else:
        m = await get_user_fm_mode(ctx.author.id)
        if not m: m = "full"
    result, is_p = await process_fm(ctx, ctx.author, mode=m)
    if result is None:
        await ctx.send(is_p)
    elif isinstance(result, dict):
        msg = await ctx.send(**result)
        if is_p: await add_custom_reactions(msg)


@bot.command(name="restart")
async def restart_bot(ctx):
    if ctx.author.id != OWNER_ID: return
    await ctx.send("🔄 Restarting bot...")
    print(f"{Log.RED}>>> Restart triggered by owner. Exiting process...{Log.RESET}")
    await bot.session.close()
    await bot.close()
    os._exit(0)


@bot.tree.command(name="restart", description="Restart the bot (Owner only)")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def restart_slash(interaction: discord.Interaction):
    if interaction.user.id != OWNER_ID:
        await interaction.response.send_message("❌ You are not the owner.", ephemeral=True)
        return
    await interaction.response.send_message("🔄 Restarting bot...", ephemeral=True)
    print(f"{Log.RED}>>> Restart triggered by owner via Slash Command. Exiting process...{Log.RESET}")
    await bot.session.close()
    await bot.close()
    os._exit(0)

@bot.command(name="ta", aliases=["topartists"])
async def ta_prefix(ctx, period: str = 'all'):
    print(f"{Log.MAGENTA}>>> [Prefix: ta] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_top_artists(ctx.author, period)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="tt", aliases=["toptracks"])
async def tt_prefix(ctx, period: str = 'all'):
    print(f"{Log.MAGENTA}>>> [Prefix: tt] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_top_tracks(ctx.author, period)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="rt", aliases=["recent"])
async def rt_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: rt] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_recent(ctx.author)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="s", aliases=["profile"])
async def s_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: s] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_profile(ctx.author)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="wk", aliases=["whoknows"])
async def wk_prefix(ctx, *, artist: str = None):
    print(f"{Log.MAGENTA}>>> [Prefix: wk] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_whoknows(ctx.guild, ctx.author, artist)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="suggest", aliases=["suggestion"])
async def suggest_prefix(ctx, *, suggestion: str):
    await process_suggestion(ctx, ctx.author, suggestion)

@bot.command(name="help")
async def help_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: help] Triggered by {ctx.author.name}{Log.RESET}")
    await ctx.send(embed=get_help_embed(ctx.author))

@bot.command(name="crowns")
async def crowns_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: crowns] Triggered by {ctx.author.name}{Log.RESET}")
    embed, err = await process_crowns(ctx.guild, ctx.author)
    await ctx.send(embed=embed) if embed else await ctx.send(err)
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
        
        # Start background import process
        asyncio.create_task(process_discord_import_in_background(user, temp_filepath, is_zip, response_target))
        
        await response_target("✅ File received successfully! The bot has started importing your Spotify history in the background. You will receive a DM as soon as it is fully finished.")
    except Exception as e:
        print(f"Error in handle_discord_import saving file: {e}")
        await response_target("❌ An error occurred while receiving your file.")

async def handle_discord_import_link(user, link, response_target):
    try:
        is_zip = link.lower().endswith(".zip") or "zip" in link.lower()
        temp_filepath = f"temp_import_{user.id}_link.{'zip' if is_zip else 'json'}"
        
        await response_target("⏳ Downloading file from link... (This may take a moment for large files)")
        async with aiohttp.ClientSession() as session:
            async with session.get(link) as resp:
                if resp.status != 200:
                    await response_target("❌ Failed to download from the provided link. Please ensure it is a direct download link.")
                    return
                with open(temp_filepath, 'wb') as f:
                    while True:
                        chunk = await resp.content.read(65536)
                        if not chunk: break
                        f.write(chunk)
        
        asyncio.create_task(process_discord_import_in_background(user, temp_filepath, is_zip, response_target))
        
    except Exception as e:
        print(f"Error in handle_discord_import_link: {e}")
        await response_target("❌ An error occurred while downloading or processing the link.")


@bot.tree.command(name="import", description="Upload your Spotify my_spotify_data.zip or StreamingHistory.json directly to import history")
@app_commands.describe(file="File to upload", link="Or provide a direct download link (e.g. from catbox.moe) if the file is too large")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def import_slash(interaction: discord.Interaction, file: discord.Attachment = None, link: str = None):
    print(f"{Log.MAGENTA}>>> [/import] Triggered by {interaction.user.name}{Log.RESET}")
    if not db_pool:
        await interaction.response.send_message("❌ Import is disabled because the database is offline.", ephemeral=True)
        return

    if not file and not link:
        await interaction.response.send_message("❌ You must provide either a file attachment or a direct download link.", ephemeral=True)
        return

    if file and not (file.filename.endswith(".zip") or file.filename.endswith(".json")):
        await interaction.response.send_message("❌ Invalid file type. Please upload a `.zip` or `.json` file.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    
    async def send_interaction_followup(text):
        await interaction.followup.send(text)

    if file:
        await handle_discord_import(interaction.user, file, send_interaction_followup)
    else:
        await handle_discord_import_link(interaction.user, link, send_interaction_followup)


@bot.command(name="import")
async def import_prefix(ctx, link: str = None):
    print(f"{Log.MAGENTA}>>> [Prefix: import] Triggered by {ctx.author.name}{Log.RESET}")
    if not db_pool:
        await ctx.send("❌ Import is disabled because the database is offline.")
        return

    if not ctx.message.attachments and not link:
        await ctx.send("❌ Please attach your Spotify `my_spotify_data.zip` or a `StreamingHistory.json` file, or provide a direct download link!")
        return

    msg = await ctx.send("📥 Downloading and parsing file...")
    
    async def edit_prefix_message(text):
        await msg.edit(content=text)

    if ctx.message.attachments:
        attachment = ctx.message.attachments[0]
        if not (attachment.filename.endswith(".zip") or attachment.filename.endswith(".json")):
            await ctx.send("❌ Invalid file type. Please upload a `.zip` or `.json` file.")
            return
        await handle_discord_import(ctx.author, attachment, edit_prefix_message)
    else:
        await handle_discord_import_link(ctx.author, link, edit_prefix_message)
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


@bot.tree.command(name="deletedata", description="Permanently delete all your database listens and unlink your Last.fm account")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def delete_data_slash(interaction: discord.Interaction):
    print(f"{Log.MAGENTA}>>> [/deletedata] Triggered by {interaction.user.name}{Log.RESET}")
    embed = discord.Embed(
        title="⚠️ Permanent Data Deletion",
        description=(
            "Are you absolutely sure you want to permanently delete all your data?\n\n"
            "This will permanently delete:\n"
            "• All your imported Spotify/Last.fm listening history in our database.\n"
            "• Your linked Last.fm account mapping.\n\n"
            "**This action is instant and CANNOT be undone.**"
        ),
        color=discord.Color.gold()
    )
    view = PurgeConfirmView(interaction.user)
    await interaction.response.send_message(embed=embed, view=view, ephemeral=True)


@bot.command(name="deletedata", aliases=["purgedata", "deleteprofile", "purgeprofile"])
async def delete_data_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: deletedata] Triggered by {ctx.author.name}{Log.RESET}")
    embed = discord.Embed(
        title="⚠️ Permanent Data Deletion",
        description=(
            "Are you absolutely sure you want to permanently delete all your data?\n\n"
            "This will permanently delete:\n"
            "• All your imported Spotify/Last.fm listening history in our database.\n"
            "• Your linked Last.fm account mapping.\n\n"
            "**This action is instant and CANNOT be undone.**"
        ),
        color=discord.Color.gold()
    )
    view = PurgeConfirmView(ctx.author)
    await ctx.send(embed=embed, view=view)@bot.tree.command(name="setcustomfm", description="Set your default layout for /fm (fm1 compact text vs fm2 full embed)")
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


@bot.command(name="setcustomfm", aliases=["customfm"])
async def set_custom_fm_prefix(ctx, mode: str = None):
    print(f"{Log.MAGENTA}>>> [Prefix: setcustomfm] Triggered by {ctx.author.name}{Log.RESET}")
    if not db_pool:
        await ctx.send("❌ Database is currently offline.")
        return

    if not mode:
        current = await get_user_fm_mode(ctx.author.id)
        display = "Compact Text (fm1)" if current == "compact" else "Full Embed (fm2)"
        await ctx.send(f"ℹ️ Your current default `/fm` layout is set to: **{display}**.\nUse `,setcustomfm fm1` (compact) or `,setcustomfm fm2` (full) to change it.")
        return

    cleaned = mode.lower().strip()
    if cleaned in ["fm1", "compact", "1"]:
        target_mode = "compact"
        display = "Compact Text (fm1)"
    elif cleaned in ["fm2", "full", "2", "embed"]:
        target_mode = "full"
        display = "Full Embed (fm2)"
    else:
        await ctx.send("❌ Invalid mode. Please choose `fm1` (compact) or `fm2` (full).")
        return

    success = await set_user_fm_mode(ctx.author.id, target_mode)
    if success:
        await ctx.send(f"✅ Your default `/fm` response is now set to **{display}**!")
    else:
        await ctx.send("❌ Failed to save setting to the database.")


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
            await update_bot_avatar_and_status(spotify_act.artist, spotify_act.album_cover_url)

    await bot.process_commands(message)

bot.run(os.getenv('DISCORD_TOKEN'))
