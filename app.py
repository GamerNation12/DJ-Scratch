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
        except Exception as e:
            print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
    else:
        print(f"{Log.YELLOW}>>> No DATABASE_URL or POSTGRES_URL set — DB disabled{Log.RESET}")
bot.setup_hook = setup_hook

db_pool = None

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

async def get_local_top_artists(user_id, limit=10, api_period='overall'):
    days = PERIOD_TO_DAYS.get(api_period)
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        rows = await db_fetch(
            "SELECT artist_name, COUNT(*) as plays FROM listens WHERE user_id=$1 AND played_at>=$2 GROUP BY artist_name ORDER BY plays DESC LIMIT $3",
            str(user_id), since, limit
        )
    else:
        rows = await db_fetch(
            "SELECT artist_name, COUNT(*) as plays FROM listens WHERE user_id=$1 GROUP BY artist_name ORDER BY plays DESC LIMIT $2",
            str(user_id), limit
        )
    return {r['artist_name']: r['plays'] for r in rows}

async def get_local_top_tracks(user_id, limit=10, api_period='overall'):
    days = PERIOD_TO_DAYS.get(api_period)
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        rows = await db_fetch(
            "SELECT track_name, artist_name, COUNT(*) as plays FROM listens WHERE user_id=$1 AND played_at>=$2 GROUP BY track_name, artist_name ORDER BY plays DESC LIMIT $3",
            str(user_id), since, limit
        )
    else:
        rows = await db_fetch(
            "SELECT track_name, artist_name, COUNT(*) as plays FROM listens WHERE user_id=$1 GROUP BY track_name, artist_name ORDER BY plays DESC LIMIT $2",
            str(user_id), limit
        )
    return [(r['track_name'], r['artist_name'], r['plays']) for r in rows]

async def get_local_total_plays(user_id):
    rows = await db_fetch("SELECT COUNT(*) as total FROM listens WHERE user_id=$1", str(user_id))
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
    print(f"{Log.YELLOW}>>> NOTE: Slash commands no longer auto-sync on boot.{Log.RESET}")
    print(f"{Log.YELLOW}>>> Type ,sync in Discord to update commands.{Log.RESET}")
    print(f"{Log.CYAN}----------------------------------------{Log.RESET}")

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
    
    # Load persistent cooldown
    if os.path.exists(COOLDOWN_FILE):
        try:
            with open(COOLDOWN_FILE, "r") as f:
                saved = datetime.fromisoformat(f.read().strip())
                if now < saved:
                    mins = (saved - now).seconds // 60
                    print(f"{Log.YELLOW}>>> Skipping avatar change. Cooldown active for {mins}m.{Log.RESET}")
                    return False, mins
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
async def fetch_artist_playcount(session, u, artist):
    async with session.get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={urllib.parse.quote(artist)}&username={u}&api_key={LASTFM_API_KEY}&format=json") as r:
        if r.status == 200:
            d = await r.json()
            return int(d['artist']['stats']['userplaycount']) if 'artist' in d else 0
    return 0

# --- CORE LOGIC ---
async def process_fm(ctx_int, user, compact=False):
    username = get_lastfm_username(user.id)
    if not username: return None, "Link Last.fm with `/setfm [username]`"
    data = await fetch_now_playing(username, 1)
    if not data: return None, "Could not find recent tracks."
    try:
        t = data['recenttracks']['track'][0]
        artist, song, album, img = t['artist']['#text'], t['name'], t['album']['#text'], t['image'][3]['#text']
        track_url = t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(artist)}/_/{urllib.parse.quote(song)}")
        is_p = t.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_p else "Last Played"
        color = LASTFM_COLOR if is_p else discord.Color.dark_gray()

        if compact:
            # Micro-Embed compact mode
            status_text = "is listening to" if is_p else "was listening to"
            desc = f"**{user.display_name}** {status_text} **[{song}]({track_url})**\nby **{artist}**"
            embed = discord.Embed(description=desc, color=color)
            if is_p:
                embed.set_thumbnail(url="https://cdn.discordapp.com/emojis/1510485193662795996.gif")
            return embed, is_p

        changed, cd = await update_bot_avatar_and_status(artist, img) if is_p else (False, 0)
        
        desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
        embed = discord.Embed(description=desc, color=color)
        embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
        if img: embed.set_thumbnail(url=img)
        
        footer_text = f"Scrobbling as {username}"
        if cd > 0: footer_text += f" • Avatar CD: {cd}m"
        embed.set_footer(text=footer_text)
        return embed, is_p
    except Exception as e: 
        print(f"{Log.RED}>>> parsing error: {e}{Log.RESET}")
        return None, "Error formatting track."

async def process_top_artists(user, input_period=None):
    username = get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    lastfm_data = {}
    if username:
        data = await fetch_top_artists(username, api_p)
        if data and 'topartists' in data:
            lastfm_data = {a['name']: int(a['playcount']) for a in data['topartists']['artist']}

    local_data = await get_local_top_artists(user.id, 50, api_p)

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
    if username:
        data = await fetch_top_tracks(username, api_p)
        if data and 'toptracks' in data:
            for t in data['toptracks']['track']:
                key = (t['name'], t['artist']['name'])
                lastfm_tracks[key] = int(t['playcount'])

    local_tracks = await get_local_top_tracks(user.id, 50, api_p)

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
            total = lastfm_plays + local_total
            embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
            if local_total > 0:
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
                embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
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
        "`/profile` (or `,s`) - View your Last.fm stats", inline=False)
    embed.add_field(name="👑 Server Stats", value=
        "`/whoknows` (or `,wk`) - See who listens to an artist most in the server\n"
        "`/crowns` (or `,crowns`) - See which of your top artists you have the most plays for in the server", inline=False)
    embed.add_field(name="💡 Other", value="`/suggest` (or `,suggest`) - Send a suggestion directly to the developer", inline=False)
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

# --- SLASH COMMANDS ---
@bot.tree.command(name="setfm", description="Link your Last.fm username to the bot")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def setfm_slash(interaction: discord.Interaction, username: str):
    user_name = username.replace("https://www.last.fm/user/", "").replace("/", "").strip()
    save_user(interaction.user.id, user_name)
    await interaction.response.send_message(f"✅ Linked your Discord to Last.fm account: **{user_name}**", ephemeral=True)

@bot.tree.command(name="fm", description="View what you are currently listening to")
@app_commands.describe(mode="compact = one line, full = full embed (default)")
@app_commands.choices(mode=[
    app_commands.Choice(name="Full Embed", value="full"),
    app_commands.Choice(name="Compact (1 line)", value="compact"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def fm_slash(interaction: discord.Interaction, mode: app_commands.Choice[str] = None):
    print(f"{Log.MAGENTA}>>> [/fm] Triggered by {interaction.user.name}{Log.RESET}")
    compact = mode is not None and mode.value == "compact"
    await interaction.response.defer()
    result, is_p = await process_fm(interaction, interaction.user, compact=compact)
    if result is None:
        await interaction.followup.send(is_p)
    elif isinstance(result, str):
        await interaction.followup.send(result)
    else:
        msg = await interaction.followup.send(embed=result, wait=True)
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
@bot.command(name="fm", aliases=["np", "nowplaying", "fm1", "fm2", "np1", "np2"])
async def fm_prefix(ctx):
    print(f"{Log.MAGENTA}>>> [Prefix: fm] Triggered by {ctx.author.name}{Log.RESET}")
    compact = ctx.invoked_with in ["fm1", "np1"]
    result, is_p = await process_fm(ctx, ctx.author, compact=compact)
    if result is None:
        await ctx.send(is_p)
    elif isinstance(result, str):
        await ctx.send(result)
    else:
        msg = await ctx.send(embed=result)
        if is_p: await add_custom_reactions(msg)

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
