import asyncio
import discord
from discord.ext import commands
from discord import app_commands
import os

from src.core.database import format_name
from src.core.spotify import (
    spotify_play_track, spotify_pause_playback, spotify_skip_to_next,
    spotify_skip_to_previous, spotify_add_to_queue, spotify_like_track,
    spotify_unlike_track, search_spotify_track, search_spotify_album,
    search_spotify_artist_full, fetch_spotify_by_id, parse_spotify_url,
    get_user_spotify_access_token, get_currently_playing_track,
    get_spotify_queue, is_track_liked
)


def _link_required_embed(user_id):
    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
    return discord.Embed(color=0xFF0000, description=f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={user_id})")


def _pretty_spotify_error(res):
    """Turn raw Spotify API failures into human messages (fmbot tells you why)."""
    s = str(res)
    if s == "no_token":
        return "❌ You need to link your Spotify account first! Use `,login` to connect."
    if "PREMIUM_REQUIRED" in s:
        return "❌ Spotify Premium is required for playback control."
    if "NO_ACTIVE_DEVICE" in s:
        return "❌ No active Spotify device. Open Spotify on your phone or computer first."
    if "Permissions missing" in s or "PERMISSION" in s.upper():
        return "❌ Spotify didn't grant that permission. Disconnect and link Spotify again with `,login`."
    return f"❌ Failed: {s[:200]}"


async def _resolve_spotify_input(session, query):
    """Turn free text (or a pasted Spotify link) into playable content.

    Returns {"kind": "track"|"album"|"artist", "info": {...}} or {"error": msg}.
    Searches track first, then album, then artist — like fmbot.
    """
    if not query or not query.strip():
        return {"error": "empty"}
    query = query.strip()

    parsed = parse_spotify_url(query)
    if parsed:
        kind, sid = parsed
        info = await fetch_spotify_by_id(session, kind, sid)
        if info:
            return {"kind": kind, "info": info}
        return {"error": "❌ Could not load that Spotify link."}

    track = await search_spotify_track(session, query)
    if track:
        return {"kind": "track", "info": track}
    album = await search_spotify_album(session, query)
    if album:
        return {"kind": "album", "info": album}
    artist = await search_spotify_artist_full(session, query)
    if artist:
        return {"kind": "artist", "info": artist}
    return {"error": "❌ Could not find that on Spotify."}

def get_spotify_remote_layout(track, user_id, action="Now playing", queue=None, liked=None):
    """Spotify remote panel (fmbot-style): header, track, up-next queue, controls.

    queue: list of {name, artists, spotify_url} (or None to hide Up next).
    liked: True/False colors the heart by state; None keeps the default look.
    """
    view = discord.ui.LayoutView(timeout=None)

    spotify_icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/240px-Spotify_logo_without_text.svg.png"

    user_id = str(user_id)

    # Not linked: show a Connect button instead of dead controls (like fmbot).
    if track == "no_token":
        import os
        app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
        section = discord.ui.Section(
            discord.ui.TextDisplay("**Spotify Remote**\nLink your Spotify account to control playback straight from Discord."),
            accessory=discord.ui.Thumbnail(spotify_icon)
        )
        row = discord.ui.ActionRow(
            discord.ui.Button(label="Connect Spotify", url=f"{app_url}/api/auth/spotify?user_id={user_id}", style=discord.ButtonStyle.link),
        )
        container = discord.ui.Container(section, row, accent_color=discord.Color.from_rgb(29, 185, 84))
        view.add_item(container)
        return view

    parts = [discord.ui.TextDisplay(f"Spotify remote - {action}")]

    if track:
        artists = ", ".join(track.get('artists') or []) or "Unknown Artist"
        album = track.get('album_name') or "Unknown Album"
        title = track.get('name') or "Unknown Track"
        images = track.get('album_images') or []
        thumbnail_url = images[0]['url'] if images and images[0].get('url') else spotify_icon
        track_url = track.get('spotify_url')
        title_md = f"[{title}]({track_url})" if track_url else title

        parts.append(discord.ui.Separator())
        parts.append(discord.ui.Section(
            discord.ui.TextDisplay(title_md),
            discord.ui.TextDisplay(f"**{artists}** • *{album}*"),
            accessory=discord.ui.Thumbnail(thumbnail_url)
        ))

        clean_queue = [q for q in (queue or []) if q and q.get("name")]
        if clean_queue:
            lines = []
            for i, q in enumerate(clean_queue[:4], 1):
                qname = f"[{q['name']}]({q['spotify_url']})" if q.get("spotify_url") else q["name"]
                qartists = ", ".join(q.get("artists") or []) or "Unknown Artist"
                lines.append(f"{i}. {qname} by {qartists}")
            parts.append(discord.ui.TextDisplay("Up next\n" + "\n".join(lines)))

    if liked is True:
        like_btn = discord.ui.Button(emoji="❤️", style=discord.ButtonStyle.danger, custom_id=f"spotify_like:{user_id}")
    elif liked is False:
        like_btn = discord.ui.Button(emoji="🤍", style=discord.ButtonStyle.secondary, custom_id=f"spotify_like:{user_id}")
    else:
        like_btn = discord.ui.Button(emoji="❤️", style=discord.ButtonStyle.success, custom_id=f"spotify_like:{user_id}")

    parts.append(discord.ui.ActionRow(
        discord.ui.Button(emoji="⏮️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_prev:{user_id}"),
        discord.ui.Button(emoji="⏸️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_pause:{user_id}"),
        discord.ui.Button(emoji="⏭️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_next:{user_id}"),
        like_btn,
        discord.ui.Button(emoji="🔄", style=discord.ButtonStyle.secondary, custom_id=f"spotify_refresh:{user_id}"),
    ))

    container = discord.ui.Container(*parts, accent_color=discord.Color.from_rgb(29, 185, 84))
    view.add_item(container)
    return view

class SpotifyRemote(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
        self.ctx_menu_play = app_commands.ContextMenu(
            name="Play on Spotify",
            callback=self.play_context_menu,
        )
        self.ctx_menu_queue = app_commands.ContextMenu(
            name="Queue on Spotify",
            callback=self.queue_context_menu,
        )
        self.bot.tree.add_command(self.ctx_menu_play)
        self.bot.tree.add_command(self.ctx_menu_queue)

    # Removed format_embed because we use get_spotify_remote_layout instead

    # --- Shared cores: each returns ("view", view) or ("embed", embed) so
    # prefix and slash commands can't drift apart. ---
    async def _act_result(self, user_id, query, action="play"):
        session = self.bot.session
        uid = str(user_id)
        token = await get_user_spotify_access_token(session, uid)
        if not token:
            return ("embed", _link_required_embed(user_id))

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return ("embed", discord.Embed(color=0xFF0000, description=resolved["error"]))

        kind, info = resolved["kind"], resolved["info"]
        if action == "play":
            if kind == "track":
                res = await spotify_play_track(session, uid, info['uri'])
            else:
                res = await spotify_play_track(session, uid, context_uri=info['uri'])
            if res is True:
                return ("view", get_spotify_remote_layout(info, user_id, "Now playing"))
            return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))
        if kind != "track":
            return ("embed", discord.Embed(color=0xFF0000, description=f"❌ Spotify only lets you queue individual tracks — use `,play` to play the full {kind}."))
        res = await spotify_add_to_queue(session, uid, info['uri'])
        if res is True:
            return ("view", get_spotify_remote_layout(info, user_id, "Added to queue"))
        return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

    async def _handle_track_command(self, ctx, query, action="play"):
        kind, payload = await self._act_result(ctx.author.id, query, action)
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    async def _remote_result(self, user_id):
        session = self.bot.session
        uid = str(user_id)
        track = await get_currently_playing_track(session, uid)
        queue, liked = [], None
        if track and track != "no_token":
            queue, liked = await asyncio.gather(
                get_spotify_queue(session, uid),
                is_track_liked(session, uid, track.get("id")),
            )
            if queue == "no_token":
                queue = []
        return ("view", get_spotify_remote_layout(track, user_id, "Now playing", queue=queue, liked=liked))

    async def _resume_result(self, user_id):
        session = self.bot.session
        uid = str(user_id)
        res = await spotify_play_track(session, uid)
        if res is True:
            track = await get_currently_playing_track(session, uid)
            return ("view", get_spotify_remote_layout(track, user_id, "Now playing"))
        if res == "no_token":
            return ("embed", _link_required_embed(user_id))
        return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

    async def _queue_current_result(self, user_id):
        session = self.bot.session
        uid = str(user_id)
        current = await get_currently_playing_track(session, uid)
        if current == "no_token":
            return ("embed", _link_required_embed(user_id))
        if not current:
            return ("embed", discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to queue."))
        res = await spotify_add_to_queue(session, uid, current['uri'])
        if res is True:
            return ("view", get_spotify_remote_layout(current, user_id, "Added to queue"))
        return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

    async def _control_result(self, user_id, op):
        session = self.bot.session
        uid = str(user_id)
        labels = {"pause": "Paused", "skip": "Skipped", "previous": "Previous track"}
        fns = {"pause": spotify_pause_playback, "skip": spotify_skip_to_next, "previous": spotify_skip_to_previous}
        res = await fns[op](session, uid)
        if res is True:
            track = await get_currently_playing_track(session, uid)
            return ("view", get_spotify_remote_layout(track, user_id, labels[op]))
        if res == "no_token":
            return ("embed", _link_required_embed(user_id))
        return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

    async def _like_result(self, user_id, query, like: bool):
        session = self.bot.session
        uid = str(user_id)
        verb = "like" if like else "unlike"
        past = "Liked" if like else "Unliked"
        if not query:
            current = await get_currently_playing_track(session, uid)
            if current == "no_token":
                return ("embed", _link_required_embed(user_id))
            if not current:
                return ("embed", discord.Embed(color=0xFF0000, description=f"❌ Nothing is playing — give me a track to {verb}."))
            track = current
        else:
            resolved = await _resolve_spotify_input(session, query)
            if "error" in resolved:
                return ("embed", discord.Embed(color=0xFF0000, description=resolved["error"]))
            if resolved["kind"] != "track":
                return ("embed", discord.Embed(color=0xFF0000, description=f"❌ Only individual tracks can be {verb}d — pick a track, not a {resolved['kind']}."))
            track = resolved["info"]
        fn = spotify_like_track if like else spotify_unlike_track
        res = await fn(session, uid, track["id"])
        if res is True:
            return ("view", get_spotify_remote_layout(track, user_id, past))
        if res == "no_token":
            return ("embed", _link_required_embed(user_id))
        return ("embed", discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

    async def _send_result(self, interaction, result):
        kind, payload = result
        if kind == "view":
            await interaction.followup.send(view=payload)
        else:
            await interaction.followup.send(embed=payload)

    @commands.command(aliases=['rc'])
    async def remote(self, ctx, *, args: str = None):
        # `,rc disconnect` unlinks Spotify (fmbot parity).
        if args and args.strip().lower() in ("disconnect", "logout", "unlink", "dc"):
            from src.core.database import clear_user_spotify, get_user_spotify_refresh_token
            try:
                linked = bool(await get_user_spotify_refresh_token(str(ctx.author.id)))
            except Exception:
                linked = True  # fall through to the clear attempt
            if not linked:
                embed = discord.Embed(color=0xFF0000, description="❌ Your Spotify account isn't linked — nothing to disconnect.")
                return await ctx.send(embed=embed)
            ok = await clear_user_spotify(str(ctx.author.id))
            if ok:
                embed = discord.Embed(color=0x1DB954, description="✅ Spotify disconnected. Link it again anytime with `,login`.")
            else:
                embed = discord.Embed(color=0xFF0000, description="❌ Could not disconnect Spotify. Please try again later.")
            return await ctx.send(embed=embed)

        kind, payload = await self._remote_result(ctx.author.id)
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    @commands.command(aliases=['p', 'resume'])
    async def play(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                kind, payload = await self._resume_result(ctx.author.id)
                if kind == "view":
                    return await ctx.send(view=payload)
                return await ctx.send(embed=payload)
                    
        await self._handle_track_command(ctx, query, "play")

    @commands.command(aliases=['q', 'rq'])
    async def queue(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                # fmbot parity: default to the track currently playing.
                kind, payload = await self._queue_current_result(ctx.author.id)
                if kind == "view":
                    return await ctx.send(view=payload)
                return await ctx.send(embed=payload)
        await self._handle_track_command(ctx, query, "queue")

    @commands.command(aliases=['ps', 'pa'])
    async def pause(self, ctx):
        kind, payload = await self._control_result(ctx.author.id, "pause")
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    @commands.command(aliases=['sk', 'next'])
    async def skip(self, ctx):
        kind, payload = await self._control_result(ctx.author.id, "skip")
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    @commands.command(name="previous", aliases=['prev'])
    async def previous(self, ctx):
        kind, payload = await self._control_result(ctx.author.id, "previous")
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    @commands.command(aliases=['rl', 'spotifylike'])
    async def rclike(self, ctx, *, query: str = None):
        kind, payload = await self._like_result(ctx.author.id, query, like=True)
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    @commands.command(aliases=['ru', 'rcul', 'spotifyunlike'])
    async def rcunlike(self, ctx, *, query: str = None):
        kind, payload = await self._like_result(ctx.author.id, query, like=False)
        if kind == "view":
            await ctx.send(view=payload)
        else:
            await ctx.send(embed=payload)

    async def _current_ids(self, user_id):
        """(artist, song, album, current) for what's playing now, via Spotify or Last.fm.

        No Spotify link required — like fmbot, this works off Last.fm alone.
        """
        session = self.bot.session
        uid = str(user_id)
        try:
            current = await get_currently_playing_track(session, uid)
            if current and current != "no_token":
                artists = current.get("artists") or []
                return (artists[0] if artists else None, current.get("name"), current.get("album_name"), current)
        except Exception:
            pass
        try:
            from src.core.events import get_lastfm_username
            from src.utils.api import fetch_now_playing
            username = await get_lastfm_username(user_id)
            if username:
                data = await fetch_now_playing(username, 1)
                tracks = (data or {}).get("recenttracks", {}).get("track") or []
                if tracks:
                    t = tracks[0]
                    artist = (t.get("artist") or {}).get("#text")
                    album = (t.get("album") or {}).get("#text")
                    return (artist, t.get("name"), album, None)
        except Exception:
            pass
        return (None, None, None, None)

    def _link_embed(self, kind, info):
        url = (info or {}).get("spotify_url")
        if not url:
            return discord.Embed(color=0xFF0000, description=f"❌ Could not find that {kind} on Spotify.")
        name = info.get("name") or "Unknown"
        artists = ", ".join(info.get("artists") or []) or "Unknown Artist"
        if kind == "track":
            desc = f"🎵 **{name}** by **{artists}**\n[Open in Spotify]({url})"
        elif kind == "album":
            desc = f"💽 **{name}** by **{artists}**\n[Open in Spotify]({url})"
        else:
            desc = f"🎤 **{name}**\n[Open in Spotify]({url})"
        embed = discord.Embed(color=0x1DB954, description=desc)
        images = info.get("album_images") or []
        if images and images[0].get("url"):
            embed.set_thumbnail(url=images[0]["url"])
        return embed

    async def _link_result(self, user_id, query, want):
        """Shared sp/spab/spa core. want in track/album/artist. Returns embed."""
        session = self.bot.session
        if not query:
            artist, song, album, current = await self._current_ids(user_id)
            if want == "track":
                if current and current.get("spotify_url"):
                    return self._link_embed("track", current)
                if not song:
                    return discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to look up. (Link Last.fm with `,login` for automatic detection.)")
                info = await search_spotify_track(session, f"{song} {artist or ''}".strip())
                if not info:
                    return discord.Embed(color=0xFF0000, description="❌ Could not find that track on Spotify.")
                return self._link_embed("track", info)
            if want == "album":
                if not album:
                    return discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me an album to look up.")
                info = await search_spotify_album(session, f"{album} {artist or ''}".strip())
                if not info:
                    return discord.Embed(color=0xFF0000, description="❌ Could not find that album on Spotify.")
                return self._link_embed("album", info)
            if not artist:
                return discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me an artist to look up.")
            info = await search_spotify_artist_full(session, artist)
            if not info:
                return discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify.")
            return self._link_embed("artist", info)

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return discord.Embed(color=0xFF0000, description=resolved["error"])
        kind, info = resolved["kind"], resolved["info"]
        if kind == want:
            return self._link_embed(want, info)
        if want == "track":
            hint = "`,spab`" if kind == "album" else "`,spa`"
            return discord.Embed(color=0xFF0000, description=f"That's an {kind} — use {hint} for {kind} links.")
        if want == "album":
            # A track resolves to its album; an artist needs a specific album name.
            if kind == "track" and info.get("album_name"):
                artists = info.get("artists") or []
                album_info = await search_spotify_album(session, f"{info['album_name']} {artists[0] if artists else ''}".strip())
                if album_info:
                    return self._link_embed("album", album_info)
                return discord.Embed(color=0xFF0000, description="❌ Could not find that album on Spotify.")
            return discord.Embed(color=0xFF0000, description="That's an artist — which album? Try `,spab <album>.")
        # want == "artist": a track/album resolves to its first artist.
        artists = info.get("artists") or []
        if not artists:
            return discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify.")
        artist_info = await search_spotify_artist_full(session, artists[0])
        if not artist_info:
            return discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify.")
        return self._link_embed("artist", artist_info)

    @commands.command(name="spotify", aliases=['sp'])
    async def spotify_link(self, ctx, *, query: str = None):
        """Spotify link for your current track, or search. No link required."""
        await ctx.send(embed=await self._link_result(ctx.author.id, query, "track"))

    @commands.command(name="spotifyalbum", aliases=['spab'])
    async def spotify_album_link(self, ctx, *, query: str = None):
        """Spotify link for your current album, or search. No link required."""
        await ctx.send(embed=await self._link_result(ctx.author.id, query, "album"))

    @commands.command(name="spotifyartist", aliases=['spa'])
    async def spotify_artist_link(self, ctx, *, query: str = None):
        """Spotify link for your current artist, or search. No link required."""
        await ctx.send(embed=await self._link_result(ctx.author.id, query, "artist"))

    # --- SLASH COMMANDS (same cores as prefix above) ---
    @app_commands.command(name="remote", description="Open the Spotify remote panel with live controls")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def remote_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        await self._send_result(interaction, await self._remote_result(interaction.user.id))

    @app_commands.command(name="play", description="Play a track, album or artist on Spotify (empty = resume)")
    @app_commands.describe(query="Track, album, artist, or Spotify link")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def play_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        if not query:
            await self._send_result(interaction, await self._resume_result(interaction.user.id))
        else:
            await self._send_result(interaction, await self._act_result(interaction.user.id, query, "play"))

    @app_commands.command(name="queue", description="Queue a track on Spotify (empty = current track)")
    @app_commands.describe(query="Track or Spotify track link")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def queue_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        if not query:
            await self._send_result(interaction, await self._queue_current_result(interaction.user.id))
        else:
            await self._send_result(interaction, await self._act_result(interaction.user.id, query, "queue"))

    @app_commands.command(name="pause", description="Pause Spotify playback")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def pause_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        await self._send_result(interaction, await self._control_result(interaction.user.id, "pause"))

    @app_commands.command(name="skip", description="Skip to the next Spotify track")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def skip_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        await self._send_result(interaction, await self._control_result(interaction.user.id, "skip"))

    @app_commands.command(name="previous", description="Go back to the previous Spotify track")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def previous_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        await self._send_result(interaction, await self._control_result(interaction.user.id, "previous"))

    @app_commands.command(name="rclike", description="Like a track on Spotify (empty = current track)")
    @app_commands.describe(query="Track or Spotify track link")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def rclike_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        await self._send_result(interaction, await self._like_result(interaction.user.id, query, like=True))

    @app_commands.command(name="rcunlike", description="Unlike a track on Spotify (empty = current track)")
    @app_commands.describe(query="Track or Spotify track link")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def rcunlike_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        await self._send_result(interaction, await self._like_result(interaction.user.id, query, like=False))

    @app_commands.command(name="spotify", description="Spotify link for your current track, or search")
    @app_commands.describe(query="Track or Spotify link (empty = current track)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def spotify_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        await interaction.followup.send(embed=await self._link_result(interaction.user.id, query, "track"))

    @app_commands.command(name="spotifyalbum", description="Spotify link for your current album, or search")
    @app_commands.describe(query="Album or Spotify link (empty = current album)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def spotifyalbum_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        await interaction.followup.send(embed=await self._link_result(interaction.user.id, query, "album"))

    @app_commands.command(name="spotifyartist", description="Spotify link for your current artist, or search")
    @app_commands.describe(query="Artist or Spotify link (empty = current artist)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def spotifyartist_slash(self, interaction: discord.Interaction, query: str = None):
        await interaction.response.defer()
        await interaction.followup.send(embed=await self._link_result(interaction.user.id, query, "artist"))

    async def play_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Could not find track.")
            return await interaction.followup.send(embed=embed)
            
        res = await spotify_play_track(session, str(interaction.user.id), track['uri'])
        if res is True:
            view = get_spotify_remote_layout(track, interaction.user.id, "Now playing")
            await interaction.followup.send(view=view)
        elif res == "no_token":
            embed = discord.Embed(color=0xFF0000, description="❌ You need to link your Spotify account first.")
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await interaction.followup.send(embed=embed)

    async def queue_context_menu(self, interaction: discord.Interaction, message: discord.Message):
        await interaction.response.defer(ephemeral=True)
        query = message.content
        session = self.bot.session
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Could not find track.")
            return await interaction.followup.send(embed=embed)
            
        res = await spotify_add_to_queue(session, str(interaction.user.id), track['uri'])
        if res is True:
            view = get_spotify_remote_layout(track, interaction.user.id, "Added to queue")
            await interaction.followup.send(view=view)
        elif res == "no_token":
            embed = discord.Embed(color=0xFF0000, description="❌ You need to link your Spotify account first.")
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await interaction.followup.send(embed=embed)

async def setup(bot):
    await bot.add_cog(SpotifyRemote(bot))
