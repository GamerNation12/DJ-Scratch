import discord
from discord import app_commands
from discord.ext import commands, tasks

SUPPORT_GUILD_ID = 1527127381897383946


async def _fm_json(session, method, username, extra=None, timeout_s=8):
    """One bounded Last.fm call. None on any failure."""
    import asyncio as _aio
    import urllib.parse
    from src.core.config import LASTFM_API_KEY
    try:
        u = urllib.parse.quote(username or "")
        if not u:
            return None
        url = (f"https://ws.audioscrobbler.com/2.0/?method={method}&user={u}"
               f"&api_key={LASTFM_API_KEY}&format=json")
        if extra:
            for k, v in extra.items():
                url += f"&{k}={urllib.parse.quote(str(v))}"
        async with session.get(url, timeout=timeout_s) as resp:
            if resp.status != 200:
                return None
            return await resp.json(content_type=None)
    except Exception:
        return None
    return None


class CommunitySpotlightCog(commands.Cog):
    """Daily random community picks: song / member / album of the day."""

    def __init__(self, bot):
        import asyncio as _aio
        self.bot = bot
        self._lock = _aio.Lock()

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
            # Support server only: boards live in #songs/#users/#albums there.
            if int(getattr(guild, "id", 0)) != SUPPORT_GUILD_ID:
                continue
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

    async def _lastfm_pools(self, linked):
        """Bounded Last.fm candidate pools: tracks/albums/users. Capped members, semaphore, timeouts."""
        import asyncio as _aio
        tracks: list = []
        albums: list = []
        users: dict = {}
        try:
            members = [(uid, lname) for uid, lname in (linked or {}).items() if lname][:20]
            session = getattr(self.bot, "session", None)
            if not members or session is None:
                return {"tracks": tracks, "albums": albums, "users": users}
            sem = _aio.Semaphore(5)

            async def _one(uid, lname):
                async with sem:
                    try:
                        t = await _fm_json(session, "user.gettoptracks", lname,
                                           {"period": "7day", "limit": "5"})
                        a = await _fm_json(session, "user.gettopalbums", lname,
                                           {"period": "7day", "limit": "3"})
                        return uid, t, a
                    except Exception:
                        return uid, None, None

            results = await _aio.gather(*[_one(uid, lname) for uid, lname in members])
            for uid, t, a in results:
                if not isinstance(uid, str) and uid is not None:
                    uid = str(uid)
                week = 0
                try:
                    arr = ((t or {}).get("toptracks") or {}).get("track") or []
                    arr = arr if isinstance(arr, list) else [arr]
                    for x in arr[:5]:
                        an = x.get("artist", {})
                        an = an.get("name") if isinstance(an, dict) else an
                        pc = int(x.get("playcount") or 0)
                        if x.get("name") and an:
                            tracks.append((x["name"], an, pc, uid))
                        week += pc
                except Exception:
                    pass
                try:
                    arr = ((a or {}).get("topalbums") or {}).get("album") or []
                    arr = arr if isinstance(arr, list) else [arr]
                    for x in arr[:3]:
                        an = x.get("artist", {})
                        an = an.get("name") if isinstance(an, dict) else an
                        pc = int(x.get("playcount") or 0)
                        if x.get("name") and an:
                            albums.append((x["name"], an, pc, uid))
                except Exception:
                    pass
                if week > 0:
                    users[uid] = week
        except Exception:
            pass
        return {"tracks": tracks, "albums": albums, "users": users}

    @staticmethod
    def _coin_pick(db_pick, fm_pool):
        """50/50 between local-DB pick and Last.fm pick (when available)."""
        import random as _random
        if fm_pool and _random.random() < 0.5:
            return _random.choice(fm_pool), True
        return db_pick, False

    async def _post_guild(self, guild: discord.Guild, force: bool = False) -> dict:
        """Post today's picks. Returns {kind: message_id or None}."""
        from src.core import database as dbmod
        from src.core.events import get_all_valid_users
        from src.core.theme import Theme
        done: dict = {}
        # One run at a time per process: the daily loop fires on every
        # restart, so without this a restart + manual post double up.
        async with self._lock:
            return await self._post_guild_inner(guild, force=force, done=done)

    async def _post_guild_inner(self, guild: discord.Guild, force: bool, done: dict) -> dict:
        from src.core import database as dbmod
        from src.core.events import get_all_valid_users
        from src.core.theme import Theme
        cfg = await dbmod.get_spotlight_config(guild.id)
        if not any(cfg.values()):
            return done
        # Global community: picks draw from every linked user (any server),
        # not just this guild's members. Guild names only feed fallbacks.
        try:
            linked = await get_all_valid_users(guild)
        except Exception:
            linked = {}
        try:
            global_names = await dbmod.get_global_fm_members(60)
        except Exception:
            global_names = {}
        names = {str(uid): (lname or "a former member") for uid, lname in global_names.items()}
        for uid, lname in (linked or {}).items():
            names.setdefault(str(uid), lname or "a former member")
        # Last.fm pools (bounded): each board flips 50/50 between local-DB
        # and Last.fm data so both sources visibly feed the picks.
        fm = await self._lastfm_pools({uid: lname for uid, lname in global_names.items()})

        jobs = []
        if cfg.get("songs"):
            jobs.append(("songs", cfg["songs"], self._song_embed))
        if cfg.get("users"):
            jobs.append(("users", cfg["users"], self._user_embed))
        if cfg.get("albums"):
            jobs.append(("albums", cfg["albums"], self._album_embed))
        if not force:
            # Restart guard: the loop runs on every boot, so skip boards
            # already posted today (manual `now:True` bypasses this).
            already = await dbmod.spotlight_posted_today(guild.id)
            jobs = [j for j in jobs if j[0] not in already]
            if not jobs:
                return done
        # Ping cooldown: mentioned in the last 7 days -> plain name, no ping.
        recent = await dbmod.spotlight_recent_mentions(guild.id)
        for kind, channel_id, builder in jobs:
            try:
                channel = guild.get_channel(int(channel_id))
                if not isinstance(channel, discord.TextChannel):
                    continue
                embed, key, pinged_uid, title, subtitle = await builder(guild, None, recent, names, fm)
                if embed is None:
                    continue
                msg = await channel.send(embed=embed)
                await dbmod.record_spotlight_post(guild.id, kind, key)
                await dbmod.record_spotlight_current(guild.id, kind, title, subtitle, key)
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

    async def _song_embed(self, guild, member_ids, recent, names, fm):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "songs")
        pick = await dbmod.get_server_random_track(member_ids, exclude)
        if not pick:
            return None, None, None, None, None
        chosen, from_fm = self._coin_pick(pick, (fm or {}).get("tracks") or [])
        fuid = None
        pinged = None
        if from_fm:
            try:
                track, artist, plays, fuid = chosen[0], chosen[1], int(chosen[2]), str(chosen[3])
            except Exception:
                from_fm = False
                fuid = None
            # Freshness shared across sources: skip recently posted, else take it.
            if from_fm and f"{str(artist).lower()}|{str(track).lower()}" in exclude:
                (track, artist, plays), from_fm, fuid = pick, False, None
        if not from_fm:
            track, artist, plays = pick
        key = f"{str(artist).lower()}|{str(track).lower()}"
        # One attribution only: the FM contributor, else the top local listener.
        star = fuid if (from_fm and fuid) else await dbmod.get_track_top_listener(None, artist, track)
        pinged = None
        if star:
            who, pinged = self._ping_or_name(guild, star, recent, names.get(star, "a community member"))
            fan_line = f"\nBiggest fan: {who}"
        else:
            fan_line = ""
        # FM picks count one user's week, not community plays — label honestly.
        scope = "plays this week" if from_fm else "community plays in the last 30 days"
        embed = Theme.get_embed(
            title="🎲 Song of the Day",
            description=f"**{track}** by **{artist}**\n*{plays:,} {scope}*{fan_line}",
            color=Theme.PREMIUM,
        )
        embed.set_footer(text=f"Fresh pick daily • from {guild.name}'s listening")
        return embed, key, pinged, track, f"{artist} • {plays:,} {scope}"

    async def _album_embed(self, guild, member_ids, recent, names, fm):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "albums")
        pick = await dbmod.get_server_random_album(member_ids, exclude)
        if not pick:
            return None, None, None, None, None
        chosen, from_fm = self._coin_pick(pick, (fm or {}).get("albums") or [])
        fuid = None
        pinged = None
        if from_fm:
            try:
                album, artist, plays, fuid = chosen[0], chosen[1], int(chosen[2]), str(chosen[3])
            except Exception:
                from_fm = False
                fuid = None
            # Freshness shared across sources: skip recently posted, else take it.
            if from_fm and f"{str(artist).lower()}|{str(album).lower()}" in exclude:
                (album, artist, plays), from_fm, fuid = pick, False, None
        if not from_fm:
            album, artist, plays = pick
        key = f"{str(artist).lower()}|{str(album).lower()}"
        # One attribution only: the FM contributor, else the top local listener.
        star = fuid if (from_fm and fuid) else await dbmod.get_album_top_listener(None, artist, album)
        pinged = None
        if star:
            who, pinged = self._ping_or_name(guild, star, recent, names.get(star, "a community member"))
            fan_line = f"\nBiggest fan: {who}"
        else:
            fan_line = ""
        # FM picks count one user's week, not community plays — label honestly.
        scope = "plays this week" if from_fm else "community plays in the last 30 days"
        embed = Theme.get_embed(
            title="💿 Album of the Day",
            description=f"**{album}** by **{artist}**\n*{plays:,} {scope}*{fan_line}",
            color=Theme.PRIMARY,
        )
        embed.set_footer(text=f"Fresh pick daily • from {guild.name}'s listening")
        return embed, key, pinged, album, f"{artist} • {plays:,} {scope}"

    async def _user_embed(self, guild, member_ids, recent, names, fm):
        from src.core import database as dbmod
        from src.core.theme import Theme
        exclude = await dbmod.spotlight_posted_keys(guild.id, "users")
        pick = await dbmod.get_server_random_listener(member_ids, exclude)
        if not pick:
            return None, None, None, None, None
        uid, plays = pick
        from_fm = False
        fm_users = (fm or {}).get("users") or {}
        if fm_users:
            import random as _random
            if _random.random() < 0.5:
                candidates = [u for u in fm_users if u not in exclude] or list(fm_users.keys())
                uid = _random.choice(candidates)
                plays = fm_users[uid]
                from_fm = True
        who, pinged = self._ping_or_name(guild, uid, recent, names.get(uid, "a former member"))
        try:
            _m = guild.get_member(int(uid))
            plain = _m.display_name if _m else names.get(uid, "a former member")
        except Exception:
            plain = names.get(uid, "a former member")
        top = await dbmod.get_user_week_top_artist(uid)
        top_line = f"\n🔥 Top artist this week: **{top[0]}** ({top[1]:,} plays)" if top else ""
        scope = "plays this week" if from_fm else "plays in the last 30 days"
        embed = Theme.get_embed(
            title="🌟 Member Spotlight",
            description=f"{who} put up **{plays:,}** {scope}!{top_line}",
            color=Theme.SUCCESS,
        )
        embed.set_footer(text=f"Fresh pick daily • {guild.name} community")
        return embed, uid, pinged, plain, f"{plays:,} {scope}"

    async def _server_autocomplete(self, interaction: discord.Interaction, current: str):
        """Servers the user shares with the bot (for /today anywhere)."""
        try:
            user_id = interaction.user.id
            choices = []
            for g in self.bot.guilds:
                try:
                    if g.get_member(user_id) is not None:
                        choices.append(app_commands.Choice(name=g.name[:100], value=str(g.id)))
                except Exception:
                    continue
            if current:
                choices = [c for c in choices if current.lower() in c.name.lower()]
            return choices[:25]
        except Exception:
            return []

    @app_commands.command(name="today", description="Today's community picks (any server you're in)")
    @app_commands.describe(server="Server to view (defaults to this one, else support)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.autocomplete(server=_server_autocomplete)
    async def today_slash(self, interaction: discord.Interaction, server: str | None = None):
        await interaction.response.defer()
        from src.core import database as dbmod
        from src.core.theme import Theme
        # Default: the support server's posted picks — the same data as the
        # support channels and the /community page. `server` views others.
        if server:
            target = None
            try:
                if interaction.guild is not None and str(interaction.guild.id) == str(server):
                    target = interaction.guild
                else:
                    g = self.bot.get_guild(int(server))
                    if g is not None and g.get_member(interaction.user.id) is not None:
                        target = g
            except Exception:
                target = None
            if target is None:
                return await interaction.followup.send(
                    "Pick a server you're in (or leave it blank for support picks).")
            try:
                current = await dbmod.get_spotlight_current(target.id)
            except Exception:
                current = {}
            if current and any((v or {}).get("title") for v in current.values()):
                return await interaction.followup.send(embed=self._today_embed(
                    target.name, current))
            snapshot = await self._snapshot_guild(target)
            if snapshot:
                return await interaction.followup.send(embed=snapshot)
            return await interaction.followup.send(
                "That server has no picks yet — an admin can run `/spotlight` to set them up.")
        try:
            current = await dbmod.get_spotlight_current(1527127381897383946)
        except Exception:
            current = {}
        if current and any((v or {}).get("title") for v in current.values()):
            return await interaction.followup.send(embed=self._today_embed("Support Server", current))
        return await interaction.followup.send(
            "No picks posted yet — check back after the next daily drop.")

    @commands.command(name="today", aliases=["picks"])
    async def today_prefix(self, ctx):
        """Same data as the support server's picks, as a text command."""
        from src.core import database as dbmod
        try:
            current = await dbmod.get_spotlight_current(SUPPORT_GUILD_ID)
        except Exception:
            current = {}
        if current and any((v or {}).get("title") for v in current.values()):
            return await ctx.send(embed=self._today_embed("Support Server", current))
        await ctx.send("No picks posted yet — check back after the next daily drop.")

    @staticmethod
    def _today_embed(guild_name: str, current: dict):
        from src.core.theme import Theme
        embed = Theme.get_embed(
            title=f"🌟 Today's picks • {guild_name}",
            color=Theme.PREMIUM,
        )
        labels = (("songs", "🎲 Song"), ("users", "🌟 Member"), ("albums", "💿 Album"))
        for kind, label in labels:
            item = (current or {}).get(kind) or {}
            if item.get("title"):
                embed.add_field(
                    name=label,
                    value=f"**{item['title']}**\n{item.get('subtitle') or ''}",
                    inline=False,
                )
        return embed

    async def _snapshot_guild(self, guild: discord.Guild):
        """Live community snapshot for servers without posted picks (no pings, no history)."""
        from src.core import database as dbmod
        from src.core.events import get_all_valid_users
        try:
            linked = await get_all_valid_users(guild)
        except Exception:
            return None
        member_ids = list(linked.keys())
        if not member_ids:
            return None
        fm = await self._lastfm_pools(linked)
        names = {str(uid): (lname or "a former member") for uid, lname in linked.items()}
        # Suppress pings on pull views: everyone counts as recently mentioned.
        recent = set(member_ids) | set(names.keys())
        current: dict = {}
        for kind, builder in (
            ("songs", self._song_embed),
            ("users", self._user_embed),
            ("albums", self._album_embed),
        ):
            try:
                embed, _key, _pinged, title, subtitle = await builder(
                    guild, member_ids, recent, names, fm)
                if title:
                    current[kind] = {"title": title, "subtitle": subtitle}
            except Exception:
                continue
        if not current:
            return None
        return self._today_embed(f"{guild.name} (live)", current)

    async def _configure(self, guild: discord.Guild, songs, users, albums, now: bool) -> str:
        """Shared /spotlight +,spotlight core. Returns the reply text."""
        from src.core import database as dbmod
        if songs is None and users is None and albums is None and not now:
            cfg = await dbmod.get_spotlight_config(guild.id)
            lines = []
            for kind, label in (("songs", "#songs"), ("users", "#users"), ("albums", "#albums")):
                ch = cfg.get(kind)
                lines.append(f"{label}: {'<#' + str(ch) + '>' if ch else '— not set'}")
            return ("🌟 **Community spotlight config**\n" + "\n".join(lines)
                    + "\n\nSet with channels, add `now` to post today immediately.")
        if songs is not None or users is not None or albums is not None:
            current = await dbmod.get_spotlight_config(guild.id)
            await dbmod.set_spotlight_config(
                guild.id,
                songs=str(songs.id) if songs else current.get("songs"),
                users=str(users.id) if users else current.get("users"),
                albums=str(albums.id) if albums else current.get("albums"),
            )
        if now:
            done = await self._post_guild(guild, force=True)
            if done:
                return f"✅ Posted: {', '.join(sorted(done))}."
            return "Nothing posted — set channels first or no community listening found."
        return "✅ Spotlight channels saved."

    @commands.command(name="spotlight")
    @commands.has_permissions(administrator=True)
    async def spotlight_prefix(self, ctx, *, arg: str = ""):
        """Text version: ,spotlight #songs #users #albums | ,spotlight now"""
        if ctx.guild is None or int(ctx.guild.id) != SUPPORT_GUILD_ID:
            return await ctx.send("Spotlight setup lives in the support server.")
        word = (arg or "").strip().lower()
        if word in ("now", "post", "send"):
            return await ctx.send(await self._configure(ctx.guild, None, None, None, True))
        mentioned = [c for c in ctx.message.channel_mentions
                     if isinstance(c, discord.TextChannel)][:3]
        if not mentioned and not word:
            return await ctx.send(await self._configure(ctx.guild, None, None, None, False))
        songs = mentioned[0] if len(mentioned) > 0 else None
        users = mentioned[1] if len(mentioned) > 1 else None
        albums = mentioned[2] if len(mentioned) > 2 else None
        if songs is None and users is None and albums is None:
            return await ctx.send("Mention channels: `,spotlight #songs #users #albums` — or `,spotlight now`.")
        return await ctx.send(await self._configure(ctx.guild, songs, users, albums, False))

    @app_commands.command(name="spotlight", description="Daily random picks for #songs #users #albums (Support server, Admin only)")
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
        if int(interaction.guild.id) != SUPPORT_GUILD_ID:
            return await interaction.response.send_message(
                "Spotlight setup lives in the support server.", ephemeral=True)
        await interaction.response.defer(ephemeral=True)
        msg = await self._configure(interaction.guild, songs, users, albums, now)
        return await interaction.followup.send(msg, ephemeral=True)


async def setup(bot):
    await bot.add_cog(CommunitySpotlightCog(bot))
