import discord
from discord.ext import commands
from discord import app_commands
from src.core.database import set_user_fm_mode, set_user_show_features, set_user_data_source, get_user_fm_mode, get_user_show_features, get_user_data_source, get_user_timezone, set_user_timezone, get_user_show_track_playcount, set_user_show_track_playcount, get_user_update_notifs, set_user_update_notifs
from src.core.config import LASTFM_COLOR

from src.core.database import format_name




async def get_settings_embed(user_id, user):
    mode = await get_user_fm_mode(user_id)
    feats = await get_user_show_features(user_id)
    d_source = await get_user_data_source(user_id)
    playcount = await get_user_show_track_playcount(user_id)
    notifs = await get_user_update_notifs(user_id)
    tz = await get_user_timezone(user_id)
    
    embed = discord.Embed(
        title="⚙️ Personal Preferences",
        description="Customize how DJ Scratch interacts with you.\n*Changes here apply globally across all servers.*",
        color=LASTFM_COLOR
    )
    embed.set_author(name=f"{format_name(user)}", icon_url=user.display_avatar.url)
    
    # 1. Appearance
    mode_desc = "📝 **Compact**" if mode == "compact" else ("📊 **Stats**" if mode == "stats" else "🖼️ **Full Embed**")
    pc_desc = "👀 **Visible**" if playcount else "🙈 **Hidden**"
    
    embed.add_field(
        name="🎨 Appearance", 
        value=f"**Display Mode:** {mode_desc}\n*Controls the layout of the `/fm` command.*\n\n"
              f"**Track Playcount:** {pc_desc}\n*Shows your total plays for the current track on `/fm`.*", 
        inline=False
    )
    
    # 2. Data & Tracking
    ds_desc = "📦 **Imported Only**" if d_source == "imported_only" else ("🎧 **Last.fm Only**" if d_source == "lastfm_only" else "🔄 **Last.fm + Imported**")
    feat_desc = "🟢 **Enabled**" if feats else "🔴 **Disabled**"
    
    embed.add_field(
        name="⚙️ Data & Tracking", 
        value=f"**Data Source:** {ds_desc}\n*Which data pool to use for your stats.*\n\n"
              f"**Featured Artists:** {feat_desc}\n*Extracts features from song names into the artist field.*", 
        inline=False
    )
    
    # 3. General
    notifs_desc = "🔔 **Enabled**" if notifs else "🔕 **Disabled**"
    
    embed.add_field(
        name="🌍 General", 
        value=f"**Timezone:** 🌍 {tz}\n*Used to accurately calculate yearly top tracks.*\n\n"
              f"**Update Notifs:** {notifs_desc}\n*Receive a DM about new features after major updates.*", 
        inline=False
    )
    
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text="Use the dropdowns and buttons below to update your settings")
    return embed

class ModeDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Compact Text Mode", description="1-line plain text for /fm", emoji="📝", value="compact"),
            discord.SelectOption(label="Full Embed Mode", description="Detailed embed for /fm", emoji="🖼️", value="full"),
            discord.SelectOption(label="Stats View Mode", description="stats.fm style embed for /fm", emoji="📊", value="stats"),
        ]
        super().__init__(placeholder="🎨 Select Display Mode...", min_values=1, max_values=1, options=options, custom_id="mode_dropdown")

    async def callback(self, interaction: discord.Interaction):
        await set_user_fm_mode(interaction.user.id, self.values[0])
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self.view)

class DataSourceDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Combined (Last.fm + Imported)", description="Use all available data", emoji="🔄", value="combined"),
            discord.SelectOption(label="Imported Only", description="Strictly use Spotify imported data", emoji="📦", value="imported_only"),
            discord.SelectOption(label="Last.fm Only", description="Strictly use Last.fm scrobbles", emoji="🎧", value="lastfm_only"),
        ]
        super().__init__(placeholder="⚙️ Select Data Source...", min_values=1, max_values=1, options=options, custom_id="ds_dropdown")

    async def callback(self, interaction: discord.Interaction):
        await set_user_data_source(interaction.user.id, self.values[0])
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self.view)

class TimezoneDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="UTC (Default)", value="UTC"),
            discord.SelectOption(label="Pacific Time (US & Canada)", description="America/Los_Angeles", value="America/Los_Angeles"),
            discord.SelectOption(label="Mountain Time (US & Canada)", description="America/Denver", value="America/Denver"),
            discord.SelectOption(label="Central Time (US & Canada)", description="America/Chicago", value="America/Chicago"),
            discord.SelectOption(label="Eastern Time (US & Canada)", description="America/New_York", value="America/New_York"),
            discord.SelectOption(label="London", description="Europe/London", value="Europe/London"),
            discord.SelectOption(label="Central Europe", description="Europe/Berlin", value="Europe/Berlin"),
            discord.SelectOption(label="India Standard Time", description="Asia/Kolkata", value="Asia/Kolkata"),
            discord.SelectOption(label="Tokyo", description="Asia/Tokyo", value="Asia/Tokyo"),
            discord.SelectOption(label="Sydney", description="Australia/Sydney", value="Australia/Sydney"),
        ]
        super().__init__(placeholder="🌍 Select your timezone...", min_values=1, max_values=1, options=options, custom_id="timezone_dropdown")

    async def callback(self, interaction: discord.Interaction):
        await set_user_timezone(interaction.user.id, self.values[0])
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self.view)

class SettingsView(discord.ui.View):
    def __init__(self, user_id, feats, playcount, notifs):
        super().__init__(timeout=None)
        
        # Row 1: Toggles (Buttons)
        self.btn_feats = discord.ui.Button(label="Featured Artists", style=discord.ButtonStyle.green if feats else discord.ButtonStyle.secondary, emoji="🎤", custom_id="toggle_feats", row=0)
        self.btn_pc = discord.ui.Button(label="Track Playcount", style=discord.ButtonStyle.green if playcount else discord.ButtonStyle.secondary, emoji="👀", custom_id="toggle_pc", row=0)
        self.btn_notifs = discord.ui.Button(label="Update Notifs", style=discord.ButtonStyle.green if notifs else discord.ButtonStyle.secondary, emoji="🔔", custom_id="toggle_notifs", row=0)
        
        self.btn_feats.callback = self.toggle_feats
        self.btn_pc.callback = self.toggle_pc
        self.btn_notifs.callback = self.toggle_notifs
        
        self.add_item(self.btn_feats)
        self.add_item(self.btn_pc)
        self.add_item(self.btn_notifs)
        
        # Row 2, 3, 4: Dropdowns
        mode_dd = ModeDropdown()
        mode_dd.row = 1
        self.add_item(mode_dd)
        
        ds_dd = DataSourceDropdown()
        ds_dd.row = 2
        self.add_item(ds_dd)
        
        tz_dd = TimezoneDropdown()
        tz_dd.row = 3
        self.add_item(tz_dd)

    async def toggle_feats(self, interaction: discord.Interaction):
        current = await get_user_show_features(interaction.user.id)
        new_val = not current
        await set_user_show_features(interaction.user.id, new_val)
        self.btn_feats.style = discord.ButtonStyle.green if new_val else discord.ButtonStyle.secondary
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self)

    async def toggle_pc(self, interaction: discord.Interaction):
        current = await get_user_show_track_playcount(interaction.user.id)
        new_val = not current
        await set_user_show_track_playcount(interaction.user.id, new_val)
        self.btn_pc.style = discord.ButtonStyle.green if new_val else discord.ButtonStyle.secondary
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self)

    async def toggle_notifs(self, interaction: discord.Interaction):
        current = await get_user_update_notifs(interaction.user.id)
        new_val = not current
        await set_user_update_notifs(interaction.user.id, new_val)
        self.btn_notifs.style = discord.ButtonStyle.green if new_val else discord.ButtonStyle.secondary
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self)



# --- CORE LOGIC ---

class SettingsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="settings", description="Configure your bot preferences")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def settings_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        feats = await get_user_show_features(interaction.user.id)
        playcount = await get_user_show_track_playcount(interaction.user.id)
        notifs = await get_user_update_notifs(interaction.user.id)
        view = SettingsView(interaction.user.id, feats, playcount, notifs)
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.followup.send("⚙️ **Settings Menu**\nUse the buttons and dropdowns below to customize your experience.", embed=embed, view=view, ephemeral=True)

    @commands.command(name="settings", aliases=["set", "se", "s"])
    async def settings_prefix(self, ctx):
        feats = await get_user_show_features(ctx.author.id)
        playcount = await get_user_show_track_playcount(ctx.author.id)
        notifs = await get_user_update_notifs(ctx.author.id)
        view = SettingsView(ctx.author.id, feats, playcount, notifs)
        embed = await get_settings_embed(ctx.author.id, ctx.author)
        await ctx.send("⚙️ **Settings Menu**\nUse the buttons and dropdowns below to customize your experience.", embed=embed, view=view)

class ServerSettingsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="server", description="Configure server settings (Admin only)")
    @app_commands.describe(prefix="Set a custom prefix for this server (default: ,)")
    @app_commands.default_permissions(manage_guild=True)
    async def server_settings_slash(self, interaction: discord.Interaction, prefix: str = None):
        if not interaction.guild:
            return await interaction.response.send_message("This command can only be used in a server.", ephemeral=True)
        if not interaction.user.guild_permissions.manage_guild:
            return await interaction.response.send_message("You need 'Manage Server' permissions to use this command.", ephemeral=True)
            
        await interaction.response.defer()
        if prefix:
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("INSERT INTO server_settings (guild_id, prefix) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET prefix=$2", str(interaction.guild.id), prefix)
            embed = discord.Embed(title="Server Settings Updated", description=f"The command prefix for **{interaction.guild.name}** has been set to `{prefix}`", color=LASTFM_COLOR)
            await interaction.followup.send(embed=embed)
        else:
            async with self.bot.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT prefix FROM server_settings WHERE guild_id=$1", str(interaction.guild.id))
            curr_prefix = row['prefix'] if row and row['prefix'] else ','
            embed = discord.Embed(title=f"Server Settings: {interaction.guild.name}", description=f"**Current Prefix:** `{curr_prefix}`\n\nUse `/server prefix:<new_prefix>` to change it.", color=LASTFM_COLOR)
            await interaction.followup.send(embed=embed)

    @commands.command(name="server", aliases=["serverconfig", "serversettings", "prefix"])
    @commands.has_permissions(manage_guild=True)
    async def server_settings_prefix(self, ctx, *, prefix: str = None):
        if not ctx.guild:
            return await ctx.send("This command can only be used in a server.")
            
        if prefix:
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("INSERT INTO server_settings (guild_id, prefix) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET prefix=$2", str(ctx.guild.id), prefix)
            embed = discord.Embed(title="Server Settings Updated", description=f"The command prefix for **{ctx.guild.name}** has been set to `{prefix}`", color=LASTFM_COLOR)
            await ctx.send(embed=embed)
        else:
            async with self.bot.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT prefix FROM server_settings WHERE guild_id=$1", str(ctx.guild.id))
            curr_prefix = row['prefix'] if row and row['prefix'] else ','
            embed = discord.Embed(title=f"Server Settings: {ctx.guild.name}", description=f"**Current Prefix:** `{curr_prefix}`\n\nUse `.server <new_prefix>` to change it.", color=LASTFM_COLOR)
            await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(SettingsCog(bot))
    await bot.add_cog(ServerSettingsCog(bot))
