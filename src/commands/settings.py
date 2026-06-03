import discord
from discord.ext import commands
from discord import app_commands
from src.core.database import set_user_fm_mode, set_user_show_features, set_user_data_source, get_user_fm_mode, get_user_show_features, get_user_data_source
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

class SettingsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="settings", description="Configure your bot preferences")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def settings_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        view = SettingsView(interaction.user.id)
        await view.init_state()
        await interaction.followup.send("⚙️ **Settings Menu**\nUse the dropdown below to customize your experience.", view=view, ephemeral=True)

    @commands.command(name="settings")
    async def settings_prefix(self, ctx):
        view = SettingsView(ctx.author.id)
        await view.init_state()
        await ctx.send("⚙️ **Settings Menu**\nUse the dropdown below to customize your experience.", view=view)

async def setup(bot):
    await bot.add_cog(SettingsCog(bot))
