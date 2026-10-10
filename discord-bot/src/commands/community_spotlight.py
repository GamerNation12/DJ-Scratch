import discord
from discord import app_commands
from discord.ext import commands, tasks


class CommunitySpotlightCog(commands.Cog):
    """Daily random community picks: song / member / album of the day."""

    def __init__(self, bot):
        self.bot = bot

    async def cog_load(self):
        if not self._daily.is_running():
            self._daily.start()

    async def cog_unload(self):
        try:
            if self._daily.is_running():
                self._daily.cancel()
        except Exception:
            pass

    @tasks.loop(hours=24)
    async def _daily(self):
        try:
            await self.bot.wait_until_ready()
        except Exception:
            return
        for guild in list(self.bot.guilds):
            try:
                await self._post_guild(guild)
            except Exception:
                continue

    @_daily.before_loop
    async def _before_daily(self):
        try:
            await self.bot.wait_until_ready()
        except Exception:
            pass

    async def _post_guild(self, guild: discord.Guild) -> dict:
        """Post today's picks. Returns {kind: message_id or None}."""
        from src.core import database as dbmod
        from src.core.events import get_all_valid_users
        from src.core.theme import Theme
        done: dict = {}
        cfg = await dbmod.get_spotlight_config(guild.id)
        if not any(cfg.values()):
            return done
        try:
            linked = await get_all_valid_users(guild)
        except Exception:
            return done
        member_ids = list(linked.keys())
        if not member_ids:
            return done

        jobs = []
        if cfg.get("songs"):
            jobs.append(("songs", cfg["songs"], self._song_embed))
        if cfg.get("users"):
            jobs.append(("users", cfg["users"], self._user_embed))
        if cfg.get("albums"):
            jobs.append(("albums", cfg["albums"], self._album_embed))
        # Ping cooldown: mentioned in the last 7 days -> plain name, no ping.
        recent = await dbmod.spotlight_recent_mentions(guild.id)
        names = {str(uid): (lname or "a former member") for uid, lname in linked.items()}
        for kind, channel_id, builder in jobs:
            try:
                channel = guild.get_channel(int(channel_id))
                if not isinstance(channel, discord.TextChannel):
                    continue
                embed, key, pinged_uid = await builder(guild, member_ids, recent, names)
                if embed is None:
                    continue
                msg = await channel.send(embed=embed)
                await dbmod.record_spotlight_post(guild.id, kind, key)
                if pinged_uid:
                    await dbmod.record_spotlight_post(guild.id, "mention", pinged_uid)
                    recent.add(pinged_uid)
                done[kind] = msg.id
            except (discord.Forbidden, discord.HTTPException):
                continue
            except Exception:
                continue
        return done

    @staticmethod
    def _ping_or_name(guild: discord.Guild, uid: str, recent: set, fallback: str = "a community member") -> tuple[str, str | None]:
        """(display, pinged_uid). Pings unless recently mentioned or not in server."""
        try:
            m = guild.get_member(int(uid))
        except Exception:
            m = None
        if m is None:
            return fallback, None
        if uid in recent:
            return m.display_name, None
        return f"<@{uid}>", uid

    async def _song_embed(self, guild, member_ids, recent, names):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "songs")
        pick = await dbmod.get_server_random_track(member_ids, exclude)
        if not pick:
            return None, None, None
        track, artist, plays = pick
        key = f"{str(artist).lower()}|{str(track).lower()}"
        fan = await dbmod.get_track_top_listener(member_ids, artist, track)
        pinged = None
        if fan:
            who, pinged = self._ping_or_name(guild, fan, recent, names.get(fan, "a former member"))
            fan_line = f"\nBiggest fan: {who}"
        else:
            fan_line = ""
        embed = Theme.get_embed(
            title="🎲 Song of the Day",
            description=f"**{track}** by **{artist}**\n*{plays:,} community plays in the last 30 days*{fan_line}",
            color=Theme.PREMIUM,
        )
        embed.set_footer(text=f"Fresh pick daily • from {guild.name}'s listening")
        return embed, key, pinged

    async def _album_embed(self, guild, member_ids, recent, names):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "albums")
        pick = await dbmod.get_server_random_album(member_ids, exclude)
        if not pick:
            return None, None, None
        album, artist, plays = pick
        key = f"{str(artist).lower()}|{str(album).lower()}"
        fan = await dbmod.get_album_top_listener(member_ids, artist, album)
        pinged = None
        if fan:
            who, pinged = self._ping_or_name(guild, fan, recent, names.get(fan, "a former member"))
            fan_line = f"\nBiggest fan: {who}"
        else:
            fan_line = ""
        embed = Theme.get_embed(
            title="💿 Album of the Day",
            description=f"**{album}** by **{artist}**\n*{plays:,} community plays in the last 30 days*{fan_line}",
            color=Theme.PRIMARY,
        )
        embed.set_footer(text=f"Fresh pick daily • from {guild.name}'s listening")
        return embed, key, pinged

    async def _user_embed(self, guild, member_ids, recent, names):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "users")
        pick = await dbmod.get_server_random_listener(member_ids, exclude)
        if not pick:
            return None, None, None
        uid, plays = pick
        who, pinged = self._ping_or_name(guild, uid, recent, names.get(uid, "a former member"))
        top = await dbmod.get_user_week_top_artist(uid)
        top_line = f"\n🔥 Top artist this week: **{top[0]}** ({top[1]:,} plays)" if top else ""
        embed = Theme.get_embed(
            title="🌟 Member Spotlight",
            description=f"{who} put up **{plays:,}** plays in the last 30 days!{top_line}",
            color=Theme.SUCCESS,
        )
        embed.set_footer(text=f"Fresh pick daily • {guild.name} community")
        return embed, uid, pinged

    @app_commands.command(name="spotlight", description="Daily random picks for #songs #users #albums (Admin only)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        songs="Channel for Song of the Day",
        users="Channel for Member Spotlight",
        albums="Channel for Album of the Day",
        now="Post today's picks right now",
    )
    async def spotlight_slash(
        self,
        interaction: discord.Interaction,
        songs: discord.TextChannel | None = None,
        users: discord.TextChannel | None = None,
        albums: discord.TextChannel | None = None,
        now: bool = False,
    ):
        if interaction.guild is None:
            return await interaction.response.send_message("Run this in a server.", ephemeral=True)
        await interaction.response.defer(ephemeral=True)
        from src.core import database as dbmod
        if songs is None and users is None and albums is None and not now:
            cfg = await dbmod.get_spotlight_config(interaction.guild.id)
            lines = []
            for kind, label in (("songs", "#songs"), ("users", "#users"), ("albums", "#albums")):
                ch = cfg.get(kind)
                lines.append(f"{label}: {'<#' + str(ch) + '>' if ch else '— not set'}")
            return await interaction.followup.send(
                "🌟 **Community spotlight config**\n" + "\n".join(lines)
                + "\n\nSet with `/spotlight songs:#songs users:#users albums:#albums`, add `now:True` to post today immediately.",
                ephemeral=True,
            )
        if songs is not None or users is not None or albums is not None:
            current = await dbmod.get_spotlight_config(interaction.guild.id)
            await dbmod.set_spotlight_config(
                interaction.guild.id,
                songs=str(songs.id) if songs else current.get("songs"),
                users=str(users.id) if users else current.get("users"),
                albums=str(albums.id) if albums else current.get("albums"),
            )
        if now:
            done = await self._post_guild(interaction.guild)
            if done:
                return await interaction.followup.send(
                    f"✅ Posted: {', '.join(sorted(done))}.", ephemeral=True)
            return await interaction.followup.send(
                "Nothing posted — set channels first or no community listening found.", ephemeral=True)
        return await interaction.followup.send("✅ Spotlight channels saved.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(CommunitySpotlightCog(bot))
