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
    
    embed = discord.Embed(
        title="⚙️ Personal Preferences",
        description="Customize your experience with the bot below. These settings apply globally across all servers.",
        color=LASTFM_COLOR
    )
    embed.set_author(name=f"{format_name(user)}'s Settings", icon_url=user.display_avatar.url)
    
    # Mode description
    mode_desc = "📝 Compact" if mode == "compact" else ("📊 Stats" if mode == "stats" else "🖼️ Full Embed")
    embed.add_field(name="**Display Mode (`/fm`)**", value=f"> {mode_desc}\n*Changes how your now-playing track looks.*", inline=False)
    
    # Featured Artists
    feat_desc = "🟢 Enabled" if feats else "🔴 Disabled"
    embed.add_field(name="**Featured Artists**", value=f"> {feat_desc}\n*Extracts features from song names to show them in the artist field.*", inline=False)
    
    # Data source
    ds_desc = "📦 Imported Only" if d_source == "imported_only" else ("🎧 Last.fm Only" if d_source == "lastfm_only" else "🔄 Last.fm + Imported")
    embed.add_field(name="**Data Source**", value=f"> {ds_desc}\n*Choose whether to include your live Last.fm data along with your imported history.*", inline=False)
    
    # Track Playcount
    pc_desc = "👀 Visible" if playcount else "🙈 Hidden"
    embed.add_field(name="**Track Playcount (`/fm`)**", value=f"> {pc_desc}\n*Shows how many times you've played the track (or if it's your first time).* \n*(Requires Last.fm integration to be accurate)*", inline=False)
    
    # Update Notifications
    notifs = await get_user_update_notifs(user_id)
    notifs_desc = "🔔 Enabled" if notifs else "🔕 Disabled"
    embed.add_field(name="**Update Notifications**", value=f"> {notifs_desc}\n*Receive a one-time message about new features after an update.*", inline=False)
    
    # Timezone
    tz = await get_user_timezone(user_id)
    embed.add_field(name="**Timezone**", value=f"> 🌍 {tz}\n*Used to accurately calculate your yearly top tracks/artists.*", inline=False)
    
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text="Select an option from the dropdowns below to update your settings")
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
            discord.SelectOption(label="Data: Last.fm Only", description="Use strictly your Last.fm Data", emoji="🎧", value="ds_lastfm_only"),
            discord.SelectOption(label="Show Track Playcount", description="Show playcount on /fm", emoji="👀", value="pc_on"),
            discord.SelectOption(label="Hide Track Playcount", description="Hide playcount on /fm", emoji="🙈", value="pc_off"),
            discord.SelectOption(label="Enable Update Notifs", description="Turn on update alerts", emoji="🔔", value="notifs_on"),
            discord.SelectOption(label="Disable Update Notifs", description="Turn off update alerts", emoji="🔕", value="notifs_off"),
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
        elif val.startswith("pc_"):
            on = (val == "pc_on")
            await set_user_show_track_playcount(interaction.user.id, on)
        elif val.startswith("notifs_"):
            on = (val == "notifs_on")
            await set_user_update_notifs(interaction.user.id, on)
            
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
        super().__init__(placeholder="Select your timezone...", min_values=1, max_values=1, options=options, custom_id="timezone_dropdown")

    async def callback(self, interaction: discord.Interaction):
        await set_user_timezone(interaction.user.id, self.values[0])
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.response.edit_message(embed=embed, view=self.view)

class SettingsView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(SettingsDropdown())
        self.add_item(TimezoneDropdown())



# --- CORE LOGIC ---

class SettingsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="settings", description="Configure your bot preferences")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def settings_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        view = SettingsView()
        embed = await get_settings_embed(interaction.user.id, interaction.user)
        await interaction.followup.send("⚙️ **Settings Menu**\nUse the dropdown below to customize your experience.", embed=embed, view=view, ephemeral=True)

    @commands.command(name="settings", aliases=["set", "se", "s"])
    async def settings_prefix(self, ctx):
        view = SettingsView()
        embed = await get_settings_embed(ctx.author.id, ctx.author)
        await ctx.send("⚙️ **Settings Menu**\nUse the dropdown below to customize your experience.", embed=embed, view=view)

async def setup(bot):
    await bot.add_cog(SettingsCog(bot))
