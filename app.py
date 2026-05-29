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

# --- TERMINAL COLOR CODES ---
class Log:
    RESET = '\033[0m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'

# --- BOT SETUP ---
load_dotenv()
intents = discord.Intents.default()
intents.message_content = True  
intents.presences = True  
intents.members = True    
bot = commands.Bot(command_prefix=["!", ","], intents=intents)

# === LAST.FM CONFIG ===
LASTFM_API_KEY = "460b4afc585d47aa799f20a069e4bb75"
USERS_FILE = "lastfm_users.json"
COOLDOWN_FILE = "avatar_cooldown.txt"
LASTFM_COLOR = 0xba0000 

PERIOD_MAP = {
    '7d': ('7day', 'Last 7 Days'),
    '7day': ('7day', 'Last 7 Days'),
    '1m': ('1month', 'Last Month'),
    '1month': ('1month', 'Last Month'),
    '3m': ('3month', 'Last 3 Months'),
    '6m': ('6month', 'Last 6 Months'),
    '1y': ('12month', 'Last Year'),
    '12m': ('12month', 'Last Year'),
    'all': ('overall', 'All Time'),
    'overall': ('overall', 'All Time'),
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

# --- SUGGESTION BUTTONS (UI VIEW) ---
class SuggestionView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    async def handle_action(self, interaction: discord.Interaction, status: str, color: discord.Color, emoji: str):
        embed = interaction.message.embeds[0]
        try:
            user_id_str = embed.author.name.split('(')[-1].strip(')')
            suggester_id = int(user_id_str)
        except Exception:
            suggester_id = None

        embed.color = color
        embed.add_field(name="Status", value=f"{emoji} **{status}**", inline=False)
        
        for child in self.children: 
            child.disabled = True
            
        await interaction.response.edit_message(embed=embed, view=self)

        if suggester_id:
            try:
                suggester = await interaction.client.fetch_user(suggester_id)
                notify_embed = discord.Embed(
                    title=f"Suggestion {status}",
                    description=f"Your recent suggestion for The Goats DJ has been reviewed!\n\n**Your Suggestion:**\n> {embed.description}\n\n**Status:** {emoji} {status}",
                    color=color,
                    timestamp=datetime.now()
                )
                await suggester.send(embed=notify_embed)
                print(f"{Log.GREEN}>>> Notified user {suggester_id} about suggestion status: {status}{Log.RESET}")
            except Exception as e:
                print(f"{Log.RED}>>> Could not DM user {suggester_id} about suggestion: {e}{Log.RESET}")

    @discord.ui.button(label="Accept", style=discord.ButtonStyle.success, custom_id="sugg_accept")
    async def accept_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_action(interaction, "Accepted", discord.Color.green(), "✅")

    @discord.ui.button(label="Working On It", style=discord.ButtonStyle.primary, custom_id="sugg_working")
    async def working_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_action(interaction, "Working On It", discord.Color.orange(), "🛠️")

    @discord.ui.button(label="Deny", style=discord.ButtonStyle.danger, custom_id="sugg_deny")
    async def deny_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_action(interaction, "Denied", discord.Color.red(), "❌")

async def setup_hook():
    bot.add_view(SuggestionView())
bot.setup_hook = setup_hook

@bot.event
async def on_ready():
    print(f"{Log.CYAN}----------------------------------------{Log.RESET}")
    print(f"{Log.CYAN}The Goats Dj is online as {bot.user}!{Log.RESET}")
    print(f"{Log.YELLOW}>>> NOTE: Slash commands no longer auto-sync on boot.{Log.RESET}")
    print(f"{Log.YELLOW}>>> Type !sync in Discord to update commands.{Log.RESET}")
    print(f"{Log.CYAN}----------------------------------------{Log.RESET}")

async def notify_owner(error_context, error_message):
    try:
        owner = await bot.fetch_user(759433582107426816)
        
        # PTERODACTYL-PROOF STRING CONSTRUCTION
        error_text = f"An error occurred in **{error_context}**:\n"
        error_text += "```py\n"
        error_text += f"{error_message}\n"
        error_text += "```"
        
        embed = discord.Embed(title="⚠️ The Goats Dj Error", description=error_text, color=discord.Color.red(), timestamp=datetime.now())
        await owner.send(embed=embed)
    except Exception as e: 
        print(f"{Log.RED}>>> FAILED to send error DM to owner: {e}{Log.RESET}")

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    command_name = interaction.command.name if interaction.command else "Unknown"
    print(f"{Log.RED}>>> ERROR in slash command /{command_name}: {error}{Log.RESET}")
    await notify_owner(f"/{command_name}", str(error))
    if not interaction.response.is_done():
        try:
            await interaction.response.send_message("Whoops! An error occurred. The developer has been notified.", ephemeral=True)
        except: pass

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound): return
    print(f"{Log.RED}>>> ERROR in prefix command {ctx.prefix}{ctx.invoked_with}: {error}{Log.RESET}")
    await notify_owner(f"{ctx.prefix}{ctx.invoked_with}", str(error))
    try:
        await ctx.send("Whoops! An error occurred.")
    except: pass

# --- AVATAR CHANGER (PERSISTENT COOLDOWN) ---
async def update_bot_avatar_and_status(artist, image_url):
    now = datetime.now()
    
    if os.path.exists(COOLDOWN_FILE):
        try:
            with open(COOLDOWN_FILE, "r") as f:
                saved_time_str = f.read().strip()
                if saved_time_str:
                    saved_time = datetime.fromisoformat(saved_time_str)
                    if now < saved_time:
                        remaining = (saved_time - now).seconds // 60
                        print(f"{Log.YELLOW}>>> Skipping avatar change. Cooldown active for {remaining}m.{Log.RESET}")
                        return False, remaining
        except Exception:
            pass 

    if not image_url: return False, 0
        
    print(f"{Log.CYAN}>>> Downloading album art for {artist}...{Log.RESET}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url) as response:
                if response.status == 200:
                    image_bytes = await response.read()
                    await bot.user.edit(avatar=image_bytes)
                    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.listening, name=artist))
                    print(f"{Log.GREEN}>>> Bot updated status & PFP for: {artist}{Log.RESET}")
                    
                    cooldown_time = now + timedelta(minutes=10)
                    with open(COOLDOWN_FILE, "w") as f:
                        f.write(cooldown_time.isoformat())
                        
                    return True, 0
    except Exception as e: 
        print(f"{Log.RED}>>> Avatar Changer Error: {e}{Log.RESET}")
    return False, 0

async def add_custom_reactions(message):
    try:
        await message.add_reaction("<a:mc_Fire:1423825520516141138>")
        await message.add_reaction("<a:Jamming:1441565477313970259>")
        print(f"{Log.GREEN}>>> Added reactions to message!{Log.RESET}")
    except Exception as e: 
        print(f"{Log.RED}>>> Reaction Error: {e}{Log.RESET}")

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f: return json.load(f)
    return {}

def save_user(discord_id, lastfm_username):
    users = load_users()
    users[str(discord_id)] = lastfm_username
    with open(USERS_FILE, 'w') as f: json.dump(users, f)
    print(f"{Log.CYAN}>>> Saved Last.fm user: {lastfm_username} ({discord_id}){Log.RESET}")

def get_lastfm_username(discord_id):
    return load_users().get(str(discord_id))

async def api_get(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200: return await response.json()
    return None

async def fetch_now_playing(username, limit=1):
    return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={username}&api_key={LASTFM_API_KEY}&format=json&limit={limit}")

async def fetch_top_artists(username, period='overall', limit=10):
    return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user={username}&api_key={LASTFM_API_KEY}&format=json&limit={limit}&period={period}")

async def fetch_top_tracks(username, period='overall', limit=10):
    return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user={username}&api_key={LASTFM_API_KEY}&format=json&limit={limit}&period={period}")

async def fetch_user_profile(username):
    return await api_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user={username}&api_key={LASTFM_API_KEY}&format=json")

async def fetch_artist_playcount(session, username, artist):
    safe_artist = urllib.parse.quote(artist)
    async with session.get(f"http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={safe_artist}&username={username}&api_key={LASTFM_API_KEY}&format=json") as response:
        if response.status == 200:
            data = await response.json()
            try: return int(data['artist']['stats']['userplaycount'])
            except KeyError: return 0
    return 0

# --- CORE LOGIC ---
async def process_fm(ctx_int, user):
    username = get_lastfm_username(user.id)
    if not username: return None, "You haven't linked your Last.fm yet! Use `/setfm <username>` first."
    data = await fetch_now_playing(username, 1)
    if not data: return None, "Could not find recent tracks. Make sure Spotify is scrobbling!"
    try:
        track = data['recenttracks']['track'][0]
        artist, song, album, image_url = track['artist']['#text'], track['name'], track['album']['#text'], track['image'][3]['#text']
        track_url = track.get('url', f"https://www.last.fm/music/{urllib.parse.quote(artist)}/_/{urllib.parse.quote(song)}")
        is_playing = track.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_playing else "Last Played"
        color = LASTFM_COLOR if is_playing else discord.Color.dark_gray()
        
        changed, cd = await update_bot_avatar_and_status(artist, image_url) if is_playing else (False, 0)
        embed = discord.Embed(description=f"**[{song}]({track_url})**\nby **{artist}**\n*{album}*", color=color)
        embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
        if image_url: embed.set_thumbnail(url=image_url)
        
        footer_text = f"Scrobbling as {username}"
        if cd > 0: footer_text += f" • Avatar CD: {cd}m"
        embed.set_footer(text=footer_text)
        return embed, is_playing
    except (KeyError, IndexError) as e:
        print(f"{Log.RED}>>> process_fm parsing error: {e}{Log.RESET}")
        return None, "Error parsing track data."

async def process_top_artists(user, input_period=None):
    username = get_lastfm_username(user.id)
    if not username: return None, "You haven't linked your Last.fm yet! Use `/setfm <username>` first."
    api_period, display_period = get_period_data(input_period)
    data = await fetch_top_artists(username, api_period)
    if not data or 'topartists' not in data: return None, "Could not load top artists."
    desc_lines = [f"{get_medal(i)} **{a['name']}** — **{int(a['playcount']):,}** plays" for i, a in enumerate(data['topartists']['artist'])]
    embed = discord.Embed(description="\n".join(desc_lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Top Artists ({display_period})", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {user.name}")
    return embed, None

async def process_top_tracks(user, input_period=None):
    username = get_lastfm_username(user.id)
    if not username: return None, "You haven't linked your Last.fm yet! Use `/setfm <username>` first."
    api_period, display_period = get_period_data(input_period)
    data = await fetch_top_tracks(username, api_period)
    if not data or 'toptracks' not in data: return None, "Could not load top tracks."
    desc_lines = [f"{get_medal(i)} **{t['name']}** by {t['artist']['name']} — **{int(t['playcount']):,}** plays" for i, t in enumerate(data['toptracks']['track'])]
    embed = discord.Embed(description="\n".join(desc_lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Top Tracks ({display_period})", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {user.name}")
    return embed, None

async def process_recent(user):
    username = get_lastfm_username(user.id)
    if not username: return None, "You haven't linked your Last.fm yet! Use `/setfm <username>` first."
    data = await fetch_now_playing(username, 10) 
    if not data: return None, "Could not load recent history."
    desc_lines = [f"{'🎶' if i == 0 and t.get('@attr', {}).get('nowplaying') == 'true' else f'` {i+1}. `'} **{t['name']}** by {t['artist']['#text']}" for i, t in enumerate(data['recenttracks']['track'][:10])]
    embed = discord.Embed(description="\n".join(desc_lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Recent Tracks", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {user.name}")
    return embed, None

async def process_profile(user):
    username = get_lastfm_username(user.id)
    if not username: return None, "You haven't linked your Last.fm yet! Use `/setfm <username>` first."
    data = await fetch_user_profile(username)
    if not data: return None, "Could not load profile."
    info = data['user']
    embed = discord.Embed(title=f"{info['name']}'s Last.fm Profile", url=info['url'], color=LASTFM_COLOR, timestamp=datetime.now())
    embed.add_field(name="🎧 Total Scrobbles", value=f"**{int(info['playcount']):,}**", inline=True)
    embed.add_field(name="🌍 Country", value=info['country'] if info['country'] and info['country'] != "None" else "Not set", inline=True)
    if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
    embed.set_footer(text=f"Requested by {user.name}")
    return embed, None

async def process_whoknows(guild, user, artist_name):
    if not guild: return None, "The `whoknows` command can only be used inside a server!"
    users_db = load_users()
    server_member_ids = [str(m.id) for m in guild.members]
    linked_members = {uid: lname for uid, lname in users_db.items() if uid in server_member_ids}
    if not linked_members: return None, "Nobody in this server has linked their Last.fm account!"

    if not artist_name:
        username = get_lastfm_username(user.id)
        if not username: return None, "Link your account or provide an artist name: `/whoknows [artist]`"
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return None, "You aren't playing anything right now! Specify an artist: `/whoknows [artist]`"

    leaderboard = []
    async with aiohttp.ClientSession() as session:
        tasks = [(uid, lname, fetch_artist_playcount(session, lname, artist_name)) for uid, lname in linked_members.items()]
        results = await asyncio.gather(*(t[2] for t in tasks))
        for idx, playcount in enumerate(results):
            if playcount > 0:
                member_obj = guild.get_member(int(tasks[idx][0]))
                display_name = member_obj.display_name if member_obj else tasks[idx][1]
                leaderboard.append({"name": display_name, "plays": playcount})

    if not leaderboard: return None, f"Nobody in this server has listened to **{artist_name}**!"
    leaderboard = sorted(leaderboard, key=lambda x: x['plays'], reverse=True)
    desc_lines = [f"{get_medal(i)} **{u['name']}** — **{u['plays']:,}** plays" for i, u in enumerate(leaderboard[:15])]
    embed = discord.Embed(description="\n".join(desc_lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"Who knows {artist_name} in {guild.name}?", icon_url=guild.icon.url if guild.icon else None)
    
    footer_text = f"Requested by {user.name}"
    if leaderboard[0]['name'] == user.display_name: footer_text = "👑 You hold the crown! • " + footer_text
    embed.set_footer(text=footer_text)
    return embed, None

async def process_suggestion(ctx_int, user, suggestion_text):
    try:
        owner = await bot.fetch_user(759433582107426816)
        embed = discord.Embed(title="💡 New Bot Suggestion", description=suggestion_text, color=discord.Color.gold(), timestamp=datetime.now())
        embed.set_author(name=f"{user.display_name} ({user.id})", icon_url=user.display_avatar.url)
        guild_name = ctx_int.guild.name if getattr(ctx_int, 'guild', None) else "DMs / User App"
        embed.set_footer(text=f"Sent from: {guild_name}")
        
        await owner.send(embed=embed, view=SuggestionView())
        print(f"{Log.GREEN}>>> New suggestion forwarded to owner from {user.name}{Log.RESET}")
        
        confirm_embed = discord.Embed(description="✅ Your suggestion has been sent directly to the developer! Thank you.", color=discord.Color.green())
        if isinstance(ctx_int, discord.Interaction):
            await ctx_int.response.send_message(embed=confirm_embed, ephemeral=True)
        else:
            await ctx_int.send(embed=confirm_embed)
    except Exception as e:
        print(f"{Log.RED}>>> Error sending suggestion to owner: {e}{Log.RESET}")
        err_msg = "❌ Failed to send suggestion. The developer might have DMs closed."
        if isinstance(ctx_int, discord.Interaction):
            await ctx_int.response.send_message(err_msg, ephemeral=True)
        else:
            await ctx_int.send(err_msg)

# --- NEW: ADMIN SYNC COMMAND ---
@bot.command(name="sync")
async def sync_commands(ctx):
    if ctx.author.id != 759433582107426816: return
    msg = await ctx.send("Syncing slash commands globally... (This may take a moment)")
    try:
        synced = await bot.tree.sync()
        await msg.edit(content=f"✅ Successfully synced {len(synced)} slash commands globally! Discord may take a few minutes to update your client.")
        print(f"{Log.GREEN}>>> Owner synced {len(synced)} slash commands globally.{Log.RESET}")
    except Exception as e:
        await msg.edit(content=f"❌ Sync failed: {e}")
        print(f"{Log.RED}>>> Sync failed: {e}{Log.RESET}")

# --- SLASH COMMANDS ---
@bot.tree.command(name="setfm", description="Link your Last.fm username to the bot")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def setfm_slash(interaction: discord.Interaction, username: str):
    save_user(interaction.user.id, username)
    await interaction.response.send_message(f"✅ Linked your Discord to Last.fm account: **{username}**", ephemeral=True)

@bot.tree.command(name="fm", description="View what you are currently listening to")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def fm_slash(interaction: discord.Interaction):
    await interaction.response.defer()
    embed, extra = await process_fm(interaction, interaction.user)
    if not embed:
        await interaction.followup.send(extra)
        return
    msg = await interaction.followup.send(embed=embed, wait=True)
    if extra: await add_custom_reactions(msg)

@bot.tree.command(name="topartists", description="View your top played artists")
@app_commands.describe(period="The time frame to check")
@app_commands.choices(period=[
    app_commands.Choice(name="7 Days", value="7d"),
    app_commands.Choice(name="1 Month", value="1m"),
    app_commands.Choice(name="3 Months", value="3m"),
    app_commands.Choice(name="6 Months", value="6m"),
    app_commands.Choice(name="1 Year", value="1y"),
    app_commands.Choice(name="All Time", value="all"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def ta_slash(interaction: discord.Interaction, period: app_commands.Choice[str] = None):
    await interaction.response.defer()
    embed, err = await process_top_artists(interaction.user, period.value if period else 'all')
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="toptracks", description="View your top played tracks")
@app_commands.describe(period="The time frame to check")
@app_commands.choices(period=[
    app_commands.Choice(name="7 Days", value="7d"),
    app_commands.Choice(name="1 Month", value="1m"),
    app_commands.Choice(name="3 Months", value="3m"),
    app_commands.Choice(name="6 Months", value="6m"),
    app_commands.Choice(name="1 Year", value="1y"),
    app_commands.Choice(name="All Time", value="all"),
])
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def tt_slash(interaction: discord.Interaction, period: app_commands.Choice[str] = None):
    await interaction.response.defer()
    embed, err = await process_top_tracks(interaction.user, period.value if period else 'all')
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="recent", description="View your recent listening history")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def rt_slash(interaction: discord.Interaction):
    await interaction.response.defer()
    embed, err = await process_recent(interaction.user)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="profile", description="View your Last.fm stats")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def profile_slash(interaction: discord.Interaction):
    await interaction.response.defer()
    embed, err = await process_profile(interaction.user)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="whoknows", description="See who in the server listens to an artist most")
@app_commands.allowed_installs(guilds=True, users=False) 
@app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
async def wk_slash(interaction: discord.Interaction, artist: str = None):
    await interaction.response.defer()
    embed, err = await process_whoknows(interaction.guild, interaction.user, artist)
    await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

@bot.tree.command(name="suggest", description="Send a suggestion directly to the developer")
@app_commands.describe(suggestion="Your idea or feedback for the bot")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def suggest_slash(interaction: discord.Interaction, suggestion: str):
    await process_suggestion(interaction, interaction.user, suggestion)

# --- PREFIX COMMANDS ---
@bot.command(name="fm", aliases=["np", "nowplaying"])
async def fm_prefix(ctx):
    embed, extra = await process_fm(ctx, ctx.author)
    if not embed:
        await ctx.send(extra)
        return
    msg = await ctx.send(embed=embed)
    if extra: await add_custom_reactions(msg)

@bot.command(name="ta", aliases=["topartists"])
async def ta_prefix(ctx, period: str = 'all'):
    embed, err = await process_top_artists(ctx.author, period)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="tt", aliases=["toptracks"])
async def tt_prefix(ctx, period: str = 'all'):
    embed, err = await process_top_tracks(ctx.author, period)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="rt", aliases=["recent"])
async def rt_prefix(ctx):
    embed, err = await process_recent(ctx.author)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="s", aliases=["profile"])
async def s_prefix(ctx):
    embed, err = await process_profile(ctx.author)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="wk", aliases=["whoknows"])
async def wk_prefix(ctx, *, artist: str = None):
    embed, err = await process_whoknows(ctx.guild, ctx.author, artist)
    await ctx.send(embed=embed) if embed else await ctx.send(err)

@bot.command(name="suggest", aliases=["suggestion"])
async def suggest_prefix(ctx, *, suggestion: str):
    await process_suggestion(ctx, ctx.author, suggestion)

# --- AUTO-TRIGGER & REACTIONS ---
@bot.event
async def on_message(message):
    if message.author == bot.user: return
    
    content_lower = message.content.lower()
    if message.author.name == "stats.fm" or "is currently listening to" in content_lower:
        await add_custom_reactions(message)
        
        spotify_act = None
        if getattr(message, 'interaction_metadata', None) and message.guild:
            member = message.guild.get_member(message.interaction_metadata.user.id)
            if member and member.activities:
                spotify_act = next((act for act in member.activities if isinstance(act, discord.Spotify)), None)
        elif message.author.name != "stats.fm" and message.guild:
            member = message.guild.get_member(message.author.id)
            if member and member.activities:
                spotify_act = next((act for act in member.activities if isinstance(act, discord.Spotify)), None)

        if spotify_act:
            await update_bot_avatar_and_status(spotify_act.artist, spotify_act.album_cover_url)

    await bot.process_commands(message)

bot.run(os.getenv('DISCORD_TOKEN'))