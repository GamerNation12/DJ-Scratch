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
                print(f"{Log.GREEN}>>> Ensured user_settings table exists{Log.RESET}")
            bot.get_user_fm_mode = get_user_fm_mode
            bot.process_fm = process_fm
            bot.process_top_artists = process_top_artists
            bot.process_top_tracks = process_top_tracks
            bot.process_recent = process_recent
            bot.process_profile = process_profile
            bot.process_whoknows = process_whoknows
            bot.process_suggestion = process_suggestion
            bot.get_help_embed = get_help_embed
            bot.process_crowns = process_crowns
            bot.handle_discord_import = handle_discord_import
            bot.PurgeConfirmView = PurgeConfirmView
            bot.add_custom_reactions = add_custom_reactions
            bot.save_user = save_user

            cogs = ['cogs.admin', 'src.commands.lastfm', 'src.commands.importer', 'src.commands.settings']
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

async def get_user_data_source(user_id):
    if not db_pool:
        return 'combined'
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT data_source FROM user_settings WHERE user_id=$1", str(user_id))
            return row['data_source'] if row and row['data_source'] else 'combined'
    except Exception as e:
        return 'combined'

async def set_user_data_source(user_id, source):
    if not db_pool:
        return False
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_settings (user_id, data_source)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET data_source = EXCLUDED.data_source
                """,
                str(user_id), source
            )
            return True
    except Exception as e:
        return False

PERIOD_TO_DAYS = {
    '7day': 7, '1month': 30, '3month': 90, '6month': 180, '12month': 365
}







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

@tasks.loop(hours=23)
async def server_renewal_reminder():
    try:
        channel_id = 1365542563188310046
        channel = bot.get_channel(channel_id)
        if not channel:
            channel = await bot.fetch_channel(channel_id)
            
        embed = discord.Embed(
            title="⏰ Server Renewal Reminder",
            description="It's time to renew your server to keep it online!\n\n**[Click here to renew on fps.ms](https://panel.fps.ms/server/5be081c1)**",
            color=discord.Color.brand_green()
        )
        await channel.send(content=f"<@{OWNER_ID}>", embed=embed)
        print(f"{Log.GREEN}>>> Sent server renewal reminder to channel {channel_id}.{Log.RESET}")
    except Exception as e:
        print(f"{Log.RED}>>> Failed to send renewal reminder: {e}{Log.RESET}")

@server_renewal_reminder.before_loop
async def before_reminder():
    await bot.wait_until_ready()

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
    bot.loop.create_task(import_worker())
    
    # Start the background tasks
    if not server_renewal_reminder.is_running():
        server_renewal_reminder.start()

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
            await update_bot_avatar_and_status(spotify_act.artist, spotify_act.album_cover_url)

    await bot.process_commands(message)


