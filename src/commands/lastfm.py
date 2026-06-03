import discord
from discord.ext import commands
from discord import app_commands

class LastFmCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="setfm", description="Link your Last.fm username to the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def setfm_slash(self, interaction: discord.Interaction, username: str):
        user_name = username.replace("https://www.last.fm/user/", "").replace("/", "").strip()
        self.bot.save_user(interaction.user.id, user_name)
        await interaction.response.send_message(f"✅ Linked your Discord to Last.fm account: **{user_name}**", ephemeral=True)

    @app_commands.command(name="fm", description="View what you are currently listening to")
    @app_commands.describe(mode="Choose embed style")
    @app_commands.choices(mode=[
        app_commands.Choice(name="Full Embed", value="full"),
        app_commands.Choice(name="Compact (1 line)", value="compact"),
        app_commands.Choice(name="Stats (Detailed)", value="stats"),
    ])
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def fm_slash(self, interaction: discord.Interaction, mode: app_commands.Choice[str] = None):
        if mode is not None:
            m = mode.value
        else:
            m = await self.bot.get_user_fm_mode(interaction.user.id)
            if not m: m = "full"
        await interaction.response.defer()
        result, is_p = await self.bot.process_fm(interaction, interaction.user, mode=m)
        if result is None:
            await interaction.followup.send(is_p)
        elif isinstance(result, dict):
            msg = await interaction.followup.send(wait=True, **result)
            if is_p: await self.bot.add_custom_reactions(msg)

    @app_commands.command(name="topartists", description="View your top played artists")
    @app_commands.describe(period="The time frame to check")
    @app_commands.choices(period=[
        app_commands.Choice(name="7 Days", value="7d"), app_commands.Choice(name="1 Month", value="1m"),
        app_commands.Choice(name="3 Months", value="3m"), app_commands.Choice(name="6 Months", value="6m"),
        app_commands.Choice(name="1 Year", value="1y"), app_commands.Choice(name="All Time", value="all"),
    ])
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def ta_slash(self, interaction: discord.Interaction, period: app_commands.Choice[str] = None):
        await interaction.response.defer()
        embed, err = await self.bot.process_top_artists(interaction.user, period.value if period else 'all')
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="toptracks", description="View your top played tracks")
    @app_commands.describe(period="The time frame to check")
    @app_commands.choices(period=[
        app_commands.Choice(name="7 Days", value="7d"), app_commands.Choice(name="1 Month", value="1m"),
        app_commands.Choice(name="3 Months", value="3m"), app_commands.Choice(name="6 Months", value="6m"),
        app_commands.Choice(name="1 Year", value="1y"), app_commands.Choice(name="All Time", value="all"),
    ])
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def tt_slash(self, interaction: discord.Interaction, period: app_commands.Choice[str] = None):
        await interaction.response.defer()
        embed, err = await self.bot.process_top_tracks(interaction.user, period.value if period else 'all')
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="recent", description="View your recent listening history")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def rt_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_recent(interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="profile", description="View your Last.fm stats")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def profile_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_profile(interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="whoknows", description="See who in the server listens to an artist most")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def wk_slash(self, interaction: discord.Interaction, artist: str = None):
        await interaction.response.defer()
        embed, err = await self.bot.process_whoknows(interaction.guild, interaction.user, artist)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="suggest", description="Send a suggestion directly to the developer")
    @app_commands.describe(suggestion="Your idea or feedback for the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def suggest_slash(self, interaction: discord.Interaction, suggestion: str):
        await self.bot.process_suggestion(interaction, interaction.user, suggestion)

    @app_commands.command(name="help", description="View all available commands")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def help_slash(self, interaction: discord.Interaction):
        await interaction.response.send_message(embed=self.bot.get_help_embed(interaction.user))

    @app_commands.command(name="crowns", description="See which of your top artists you have the most plays for")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def crowns_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_crowns(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    # --- PREFIX COMMANDS ---
    @commands.command(name="fm", aliases=["np", "nowplaying", "fm1", "fm2", "fm3", "np1", "np2", "np3"])
    async def fm_prefix(self, ctx):
        invoked = ctx.invoked_with
        if invoked in ["fm1", "np1"]: m = "compact"
        elif invoked in ["fm2", "np2"]: m = "full"
        elif invoked in ["fm3", "np3"]: m = "stats"
        else:
            m = await self.bot.get_user_fm_mode(ctx.author.id)
            if not m: m = "full"
        result, is_p = await self.bot.process_fm(ctx, ctx.author, mode=m)
        if result is None: await ctx.send(is_p)
        elif isinstance(result, dict):
            msg = await ctx.send(**result)
            if is_p: await self.bot.add_custom_reactions(msg)

    @commands.command(name="ta", aliases=["topartists"])
    async def ta_prefix(self, ctx, period: str = 'all'):
        embed, err = await self.bot.process_top_artists(ctx.author, period)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="tt", aliases=["toptracks"])
    async def tt_prefix(self, ctx, period: str = 'all'):
        embed, err = await self.bot.process_top_tracks(ctx.author, period)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="rt", aliases=["recent"])
    async def rt_prefix(self, ctx):
        embed, err = await self.bot.process_recent(ctx.author)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="s", aliases=["profile"])
    async def s_prefix(self, ctx):
        embed, err = await self.bot.process_profile(ctx.author)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="wk", aliases=["whoknows"])
    async def wk_prefix(self, ctx, *, artist: str = None):
        embed, err = await self.bot.process_whoknows(ctx.guild, ctx.author, artist)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="suggest", aliases=["suggestion"])
    async def suggest_prefix(self, ctx, *, suggestion: str):
        await self.bot.process_suggestion(ctx, ctx.author, suggestion)

    @commands.command(name="help")
    async def help_prefix(self, ctx):
        await ctx.send(embed=self.bot.get_help_embed(ctx.author))

    @commands.command(name="crowns")
    async def crowns_prefix(self, ctx):
        embed, err = await self.bot.process_crowns(ctx.guild, ctx.author)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

async def setup(bot):
    await bot.add_cog(LastFmCog(bot))
