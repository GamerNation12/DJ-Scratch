"""Cog exposing .fmbot-parity commands (slash + prefix).

Backend lives in src/core/fmbot_extras.py. This file is only wiring,
following the style of src/commands/lastfm.py.
"""
import discord
from discord.ext import commands
from discord import app_commands


PERIODS = ["overall", "7day", "1month", "3month", "6month", "12month"]


def _period_choices():
    return [app_commands.Choice(name=p, value=p) for p in PERIODS]


class FmbotMissingCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _send(self, ctx_or_inter, embed, err=None):
        if embed is not None:
            if isinstance(ctx_or_inter, discord.Interaction):
                await ctx_or_inter.followup.send(embed=embed)
            else:
                await ctx_or_inter.reply(embed=embed, mention_author=False)
        else:
            if isinstance(ctx_or_inter, discord.Interaction):
                await ctx_or_inter.followup.send(embed=err or embed)
            else:
                await ctx_or_inter.reply(embed=err, mention_author=False)

    # ---- overview / recap / year ----
    @app_commands.command(name="overview", description="Top track/album/artist snapshot")
    @app_commands.describe(days="Days to snapshot (1-8)", user="Whose overview")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def overview_slash(self, interaction: discord.Interaction, days: int = 4, user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_overview(interaction.user, user, days)
        await interaction.followup.send(embed=embed)

    @commands.command(name="overview", aliases=["o"])
    async def overview_prefix(self, ctx, user: discord.User = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_overview(ctx.author, user, 4)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="recap", description="Combined tops recap for a period")
    @app_commands.describe(period="Time period", user="Whose recap")
    @app_commands.choices(period=[app_commands.Choice(name=p, value=p) for p in
                           ["7day", "1month", "3month", "6month", "12month", "overall"]])
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def recap_slash(self, interaction: discord.Interaction, period: app_commands.Choice[str] = None,
                          user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_recap(interaction.user, user, period.value if period else "7day")
        await interaction.followup.send(embed=embed)

    @commands.command(name="recap")
    async def recap_prefix(self, ctx, period: str = "7day"):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_recap(ctx.author, None, period)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="year", description="Yearly overview")
    @app_commands.describe(year="Year (default: current)", user="Whose year")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def year_slash(self, interaction: discord.Interaction, year: int = None, user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_year(interaction.user, user, year)
        await interaction.followup.send(embed=embed)

    @commands.command(name="year")
    async def year_prefix(self, ctx, year: int = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_year(ctx.author, None, year)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- plays / pace / milestone ----
    @app_commands.command(name="plays", description="Total scrobbles for a period")
    @app_commands.describe(period="Time period", user="Whose plays")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def plays_slash(self, interaction: discord.Interaction, period: str = "overall",
                          user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_plays(interaction.user, user, period)
        await interaction.followup.send(embed=embed)

    @commands.command(name="plays", aliases=["p"])
    async def plays_prefix(self, ctx, period: str = "overall"):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_plays(ctx.author, None, period)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="pace", description="ETA for a playcount goal")
    @app_commands.describe(goal="Goal plays (e.g. 50000)", user="Whose pace")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def pace_slash(self, interaction: discord.Interaction, goal: int, user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_pace(interaction.user, user, goal)
        await interaction.followup.send(embed=embed)

    @commands.command(name="pace", aliases=["pc"])
    async def pace_prefix(self, ctx, goal: int = 10000):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_pace(ctx.author, None, goal)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="milestone", description="Scrobble milestones")
    @app_commands.describe(amount="Which milestone", user="Whose milestones")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def milestone_slash(self, interaction: discord.Interaction, amount: int = None,
                              user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_milestone(interaction.user, user, amount)
        await interaction.followup.send(embed=embed)

    @commands.command(name="milestone", aliases=["ms"])
    async def milestone_prefix(self, ctx, amount: int = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_milestone(ctx.author, None, amount)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- genre / country ----
    @app_commands.command(name="genre", description="Genre tags for an artist")
    @app_commands.describe(artist="Artist (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def genre_slash(self, interaction: discord.Interaction, artist: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_genre(interaction.user, artist)
        await interaction.followup.send(embed=embed)

    @commands.command(name="genre")
    async def genre_prefix(self, ctx, *, artist: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_genre(ctx.author, artist)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="country", description="Country info for an artist")
    @app_commands.describe(artist="Artist (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def country_slash(self, interaction: discord.Interaction, artist: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_country(interaction.user, artist)
        await interaction.followup.send(embed=embed)

    @commands.command(name="country", aliases=["from"])
    async def country_prefix(self, ctx, *, artist: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_country(ctx.author, artist)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="countrychart", description="Top countries in your library")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def countrychart_slash(self, interaction: discord.Interaction, period: str = "overall",
                                 user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_countrychart(interaction.user, user, period)
        await interaction.followup.send(embed=embed)

    @commands.command(name="countrychart")
    async def countrychart_prefix(self, ctx, period: str = "overall"):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_countrychart(ctx.author, None, period)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- leaderboards / affinity / friends ----
    @app_commands.command(name="scrobbleleaderboard", description="Most plays in this server")
    async def sblb_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_scrobbleleaderboard(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="scrobbleleaderboard", aliases=["sblb"])
    async def sblb_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_scrobbleleaderboard(ctx.guild, ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="timeleaderboard", description="Most listening time in server (est.)")
    async def tlb_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_timeleaderboard(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="timeleaderboard", aliases=["tlb"])
    async def tlb_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_timeleaderboard(ctx.guild, ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="affinity", description="Whose taste matches yours most")
    async def affinity_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_affinity(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="affinity")
    async def affinity_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_affinity(ctx.guild, ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="friendswhoknow", description="Which friends listen to an artist")
    @app_commands.describe(artist="Artist (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def fwk_slash(self, interaction: discord.Interaction, artist: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_friendswhoknow(interaction.user, self.bot, artist)
        await interaction.followup.send(embed=embed)

    @commands.command(name="friendswhoknow", aliases=["fwk"])
    async def fwk_prefix(self, ctx, *, artist: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_friendswhoknow(ctx.author, self.bot, artist)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="friends", description="List your DJ Scratch friends")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def friends_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer(ephemeral=True)
        embed, _ = await X.process_friends_list(interaction.user, self.bot)
        await interaction.followup.send(embed=embed, ephemeral=True)

    @commands.command(name="friends")
    async def friends_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_friends_list(ctx.author, self.bot)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- discovery / search / iceberg / gaps ----
    @app_commands.command(name="discoverydate", description="When did you discover this music")
    @app_commands.describe(query="Artist - Track (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def dd_slash(self, interaction: discord.Interaction, query: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_discoverydate(interaction.user, query)
        await interaction.followup.send(embed=embed)

    @commands.command(name="discoverydate", aliases=["dd"])
    async def dd_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_discoverydate(ctx.author, query)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="lastlistened", description="When did you last hear this")
    @app_commands.describe(query="Artist - Track (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def last_slash(self, interaction: discord.Interaction, query: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_lastlistened(interaction.user, query)
        await interaction.followup.send(embed=embed)

    @commands.command(name="lastlistened", aliases=["last"])
    async def last_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_lastlistened(ctx.author, query)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="discoveries", description="Artists you recently discovered")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def discoveries_slash(self, interaction: discord.Interaction, user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_discoveries(interaction.user, user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="discoveries")
    async def discoveries_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_discoveries(ctx.author, None)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="search", description="Search your library")
    @app_commands.describe(query="Text to search for")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def search_slash(self, interaction: discord.Interaction, query: str):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_search(interaction.user, query)
        await interaction.followup.send(embed=embed)

    @commands.command(name="search", aliases=["sr", "find"])
    async def search_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_search(ctx.author, query or "")
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="iceberg", description="Artist popularity iceberg")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def iceberg_slash(self, interaction: discord.Interaction, period: str = "overall"):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_iceberg(interaction.user, None, period)
        await interaction.followup.send(embed=embed)

    @commands.command(name="iceberg")
    async def iceberg_prefix(self, ctx, period: str = "overall"):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_iceberg(ctx.author, None, period)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="gaps", description="Fave artists you haven't heard lately")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def gaps_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_gaps(interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="gaps")
    async def gaps_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_gaps(ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- lyrics / loved / scrobble / links ----
    @app_commands.command(name="lyrics", description="Lyrics for now playing or query")
    @app_commands.describe(query="Artist - Track (blank = now playing)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def lyrics_slash(self, interaction: discord.Interaction, query: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_lyrics_cmd(interaction.user, self.bot, query)
        await interaction.followup.send(embed=embed)

    @commands.command(name="lyrics")
    async def lyrics_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_lyrics_cmd(ctx.author, self.bot, query)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="loved", description="Your loved tracks on Last.fm")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def loved_slash(self, interaction: discord.Interaction, user: discord.User = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_loved(interaction.user, user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="loved")
    async def loved_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_loved(ctx.author, None)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="love", description="Love the current track (guidance)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def love_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        embed, _ = X.process_love_guidance(interaction.user)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @commands.command(name="love")
    async def love_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = X.process_love_guidance(ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="unlove", description="Unlove guidance (Last.fm write needed)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def unlove_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        embed, _ = X.process_love_guidance(interaction.user)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="scrobble", description="Manually scrobble (guidance)")
    @app_commands.describe(query="Artist - Track to scrobble")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def scrobble_slash(self, interaction: discord.Interaction, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = X.process_scrobble_guidance(interaction.user, query)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @commands.command(name="scrobble")
    async def scrobble_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        embed, _ = X.process_scrobble_guidance(ctx.author, query)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="youtube", description="YouTube link for a query")
    @app_commands.describe(query="What to search")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def youtube_slash(self, interaction: discord.Interaction, query: str):
        from src.core import fmbot_extras as X
        embed, _ = X.process_link(interaction.user, "youtube", query)
        await interaction.response.send_message(embed=embed)

    @commands.command(name="youtube", aliases=["yt"])
    async def youtube_prefix(self, ctx, *, query: str = None):
        from src.core import fmbot_extras as X
        from src.utils.api import fetch_now_playing
        from src.core.events import get_lastfm_username
        q = query
        if not q:
            try:
                ln = await get_lastfm_username(ctx.author.id)
                d = await fetch_now_playing(ln, 1)
                t = d["recenttracks"]["track"][0]
                an = t["artist"]["#text"]
                q = f"{an} - {t.get('name')}"
            except Exception:
                q = ""
        embed, _ = X.process_link(ctx.author, "youtube", q or "music")
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="applemusic", description="Apple Music link for a query")
    @app_commands.describe(query="What to search")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def applemusic_slash(self, interaction: discord.Interaction, query: str):
        from src.core import fmbot_extras as X
        embed, _ = X.process_link(interaction.user, "applemusic", query)
        await interaction.response.send_message(embed=embed)

    # ---- featured ----
    @app_commands.command(name="featured", description="Hourly featured listener")
    async def featured_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_featured(self.bot, interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="featured")
    async def featured_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_featured(self.bot, ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="featuredlog", description="Last featured listener")
    async def featuredlog_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_featuredlog(interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="featuredlog")
    async def featuredlog_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_featuredlog(ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    # ---- customization ----
    @app_commands.command(name="responsemode", description="Default layout for tops/whoknows")
    @app_commands.describe(mode="embed, image or pagination")
    @app_commands.choices(mode=[app_commands.Choice(name=m, value=m) for m in
                                ["embed", "image", "pagination"]])
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def responsemode_slash(self, interaction: discord.Interaction, mode: app_commands.Choice[str] = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer(ephemeral=True)
        embed, _ = await X.process_responsemode(interaction.user, mode.value if mode else None)
        await interaction.followup.send(embed=embed, ephemeral=True)

    @commands.command(name="responsemode")
    async def responsemode_prefix(self, ctx, mode: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_responsemode(ctx.author, mode)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="userreactions", description="Auto-emoji on your /fm")
    @app_commands.describe(emojis="Emojis separated by space (blank = clear)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def userreactions_slash(self, interaction: discord.Interaction, emojis: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer(ephemeral=True)
        embed, _ = await X.process_userreactions(interaction.user, emojis)
        await interaction.followup.send(embed=embed, ephemeral=True)

    @commands.command(name="userreactions")
    async def userreactions_prefix(self, ctx, *, emojis: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_userreactions(ctx.author, emojis)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="shortcuts", description="Custom text-command shortcuts")
    @app_commands.describe(name="Shortcut name", command="Command it runs")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def shortcuts_slash(self, interaction: discord.Interaction, name: str = None, command: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer(ephemeral=True)
        embed, _ = await X.process_shortcuts(interaction.user, name, command)
        await interaction.followup.send(embed=embed, ephemeral=True)

    @commands.command(name="shortcuts", aliases=["sc"])
    async def shortcuts_prefix(self, ctx, name: str = None, *, command: str = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_shortcuts(ctx.author, name, command)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="localization", description="Timezone + number format")
    @app_commands.describe(timezone="e.g. Europe/Berlin", number_format="e.g. 1,000 or 1.000")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def localization_slash(self, interaction: discord.Interaction, timezone: str = None,
                                 number_format: str = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer(ephemeral=True)
        embed, _ = await X.process_localization(interaction.user, timezone, number_format)
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ---- server admin ----
    @app_commands.command(name="members", description="Linked members in this server")
    async def members_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_members(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed)

    @commands.command(name="members", aliases=["mb"])
    async def members_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_members(ctx.guild, ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="togglecommand", description="Enable/disable a command (Manage Server)")
    @app_commands.describe(command="Command name", enabled="On or off")
    @app_commands.default_permissions(manage_guild=True)
    async def togglecommand_slash(self, interaction: discord.Interaction, command: str, enabled: bool):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_togglecommand(interaction.guild, interaction.user, command,
                                                 None, enabled)
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="autoposter", description="Server listening digest channel")
    @app_commands.describe(channel="Channel (leave blank for status)")
    @app_commands.default_permissions(manage_guild=True)
    async def autoposter_slash(self, interaction: discord.Interaction, channel: discord.TextChannel = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_autoposter(interaction.guild, interaction.user, channel, "status" if not channel else "set")
        await interaction.followup.send(embed=embed)

    @commands.command(name="autoposter")
    @commands.has_permissions(manage_guild=True)
    async def autoposter_prefix(self, ctx, channel: discord.TextChannel = None):
        from src.core import fmbot_extras as X
        embed, _ = await X.process_autoposter(ctx.guild, ctx.author, channel, "status" if not channel else "set")
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="botscrobbling", description="Scrobble Discord music bots to Last.fm")
    @app_commands.describe(enabled="On or off (blank = status)")
    @app_commands.default_permissions(manage_guild=True)
    async def botscrobbling_slash(self, interaction: discord.Interaction, enabled: bool = None):
        from src.core import fmbot_extras as X
        await interaction.response.defer()
        embed, _ = await X.process_botscrobbling(interaction.guild, interaction.user, enabled)
        await interaction.followup.send(embed=embed)

    @commands.command(name="botscrobbling")
    async def botscrobbling_prefix(self, ctx, enabled: str = None):
        from src.core import fmbot_extras as X
        val = None if enabled is None else enabled.lower() in ("on", "true", "yes", "1")
        embed, _ = await X.process_botscrobbling(ctx.guild, ctx.author, val)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="collection", description="Discogs vinyl collection (beta)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def collection_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        embed, _ = X.process_discogs_guidance(interaction.user)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @commands.command(name="collection")
    async def collection_prefix(self, ctx):
        from src.core import fmbot_extras as X
        embed, _ = X.process_discogs_guidance(ctx.author)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="discogs", description="Link Discogs collection (beta)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def discogs_slash(self, interaction: discord.Interaction):
        from src.core import fmbot_extras as X
        embed, _ = X.process_discogs_guidance(interaction.user)
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot):
    await bot.add_cog(FmbotMissingCog(bot))
