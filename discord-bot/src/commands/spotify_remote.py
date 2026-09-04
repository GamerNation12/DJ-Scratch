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
    get_user_spotify_access_token, get_currently_playing_track
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

def get_spotify_remote_layout(track, user_id, action="Now playing"):
    view = discord.ui.LayoutView(timeout=None)
    
    spotify_icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/240px-Spotify_logo_without_text.svg.png"
    
    if track and track != "no_token":
        artists = ", ".join(track['artists'])
        album = track.get('album_name') or "Unknown Album"
        description = f"**{artists}** • *{album}*"
        title = track['name']
        thumbnail_url = track.get('album_images')[0]['url'] if track.get('album_images') else spotify_icon
    else:
        title = "Spotify Remote"
        description = "Control your playback."
        thumbnail_url = spotify_icon
        
    section = discord.ui.Section(
        discord.ui.TextDisplay(f"Spotify remote – {action}"),
        discord.ui.TextDisplay(f"{title}\n{description}"),
        accessory=discord.ui.Thumbnail(thumbnail_url)
    )
    
    user_id = str(user_id)

    # Not linked: show a Connect button instead of dead controls (like fmbot).
    if track == "no_token":
        import os
        app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
        section = discord.ui.Section(
            discord.ui.TextDisplay("**Spotify Remote**\nLink your Spotify account to control playback straight from Discord."),
            accessory=discord.ui.Thumbnail(thumbnail_url)
        )
        row = discord.ui.ActionRow(
            discord.ui.Button(label="Connect Spotify", url=f"{app_url}/api/auth/spotify?user_id={user_id}", style=discord.ButtonStyle.link),
        )
        container = discord.ui.Container(section, row, accent_color=discord.Color.from_rgb(29, 185, 84))
        view.add_item(container)
        return view

    row = discord.ui.ActionRow(
        discord.ui.Button(emoji="⏮️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_prev:{user_id}"),
        discord.ui.Button(emoji="⏸️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_pause:{user_id}"),
        discord.ui.Button(emoji="⏭️", style=discord.ButtonStyle.secondary, custom_id=f"spotify_next:{user_id}"),
        discord.ui.Button(emoji="❤️", style=discord.ButtonStyle.success, custom_id=f"spotify_like:{user_id}"),
        discord.ui.Button(emoji="🔄", style=discord.ButtonStyle.secondary, custom_id=f"spotify_refresh:{user_id}"),
    )

    container = discord.ui.Container(section, row, accent_color=discord.Color.from_rgb(29, 185, 84))
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

    async def _handle_track_command(self, ctx, query, action="play"):
        session = self.bot.session
        token = await get_user_spotify_access_token(session, str(ctx.author.id))
        if not token:
            return await ctx.send(embed=_link_required_embed(ctx.author.id))

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description=resolved["error"]))

        kind, info = resolved["kind"], resolved["info"]
        if action == "play":
            if kind == "track":
                res = await spotify_play_track(session, str(ctx.author.id), info['uri'])
            else:
                res = await spotify_play_track(session, str(ctx.author.id), context_uri=info['uri'])
            if res is True:
                view = get_spotify_remote_layout(info, ctx.author.id, "Now playing")
                await ctx.send(view=view)
            else:
                await ctx.send(embed=discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))
        else:
            if kind != "track":
                embed = discord.Embed(color=0xFF0000, description=f"❌ Spotify only lets you queue individual tracks — use `,play` to play the full {kind}.")
                return await ctx.send(embed=embed)
            res = await spotify_add_to_queue(session, str(ctx.author.id), info['uri'])
            if res is True:
                view = get_spotify_remote_layout(info, ctx.author.id, "Added to queue")
                await ctx.send(view=view)
            else:
                await ctx.send(embed=discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res)))

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

        session = self.bot.session

        # Fetch currently playing track
        track = await get_currently_playing_track(session, str(ctx.author.id))
        view = get_spotify_remote_layout(track, ctx.author.id)

        await ctx.send(view=view)

    @commands.command(aliases=['p', 'resume'])
    async def play(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                session = self.bot.session
                res = await spotify_play_track(session, str(ctx.author.id))
                if res is True:
                    track = await get_currently_playing_track(session, str(ctx.author.id))
                    view = get_spotify_remote_layout(track, ctx.author.id, "Now playing")
                    return await ctx.send(view=view)
                elif res == "no_token":
                    return await ctx.send(embed=_link_required_embed(ctx.author.id))
                else:
                    embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
                    return await ctx.send(embed=embed)
                    
        await self._handle_track_command(ctx, query, "play")

    @commands.command(aliases=['q', 'rq'])
    async def queue(self, ctx, *, query: str = None):
        if not query:
            if ctx.message.reference:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                query = msg.content
            else:
                # fmbot parity: default to the track currently playing.
                session = self.bot.session
                current = await get_currently_playing_track(session, str(ctx.author.id))
                if current == "no_token":
                    return await ctx.send(embed=_link_required_embed(ctx.author.id))
                if not current:
                    embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to queue.")
                    return await ctx.send(embed=embed)
                res = await spotify_add_to_queue(session, str(ctx.author.id), current['uri'])
                if res is True:
                    view = get_spotify_remote_layout(current, ctx.author.id, "Added to queue")
                    return await ctx.send(view=view)
                embed = discord.Embed(color=0xFF0000, description=f"❌ Failed to queue: {res}")
                return await ctx.send(embed=embed)
        await self._handle_track_command(ctx, query, "queue")

    @commands.command(aliases=['ps', 'pa'])
    async def pause(self, ctx):
        session = self.bot.session
        res = await spotify_pause_playback(session, str(ctx.author.id))
        if res is True:
            track = await get_currently_playing_track(session, str(ctx.author.id))
            view = get_spotify_remote_layout(track, ctx.author.id, "Paused")
            await ctx.send(view=view)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await ctx.send(embed=embed)

    @commands.command(aliases=['sk', 'next'])
    async def skip(self, ctx):
        session = self.bot.session
        res = await spotify_skip_to_next(session, str(ctx.author.id))
        if res is True:
            track = await get_currently_playing_track(session, str(ctx.author.id))
            view = get_spotify_remote_layout(track, ctx.author.id, "Skipped")
            await ctx.send(view=view)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await ctx.send(embed=embed)

    @commands.command(name="previous", aliases=['prev'])
    async def previous(self, ctx):
        session = self.bot.session
        res = await spotify_skip_to_previous(session, str(ctx.author.id))
        if res is True:
            track = await get_currently_playing_track(session, str(ctx.author.id))
            view = get_spotify_remote_layout(track, ctx.author.id, "Previous track")
            await ctx.send(view=view)
        elif res == "no_token":
            app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://dj-scratch.vercel.app")
            embed = discord.Embed(color=0xFF0000, description=f"❌ You need to link your Spotify account first! [Connect here]({app_url}/api/auth/spotify?user_id={ctx.author.id})")
            await ctx.send(embed=embed)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await ctx.send(embed=embed)

    @commands.command(aliases=['rl', 'spotifylike'])
    async def rclike(self, ctx, *, query: str = None):
        session = self.bot.session
        if not query:
            # fmbot parity: default to the track currently playing.
            current = await get_currently_playing_track(session, str(ctx.author.id))
            if current == "no_token":
                return await ctx.send(embed=_link_required_embed(ctx.author.id))
            if not current:
                embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to like.")
                return await ctx.send(embed=embed)
            res = await spotify_like_track(session, str(ctx.author.id), current['id'])
            if res is True:
                view = get_spotify_remote_layout(current, ctx.author.id, "Liked")
                return await ctx.send(view=view)
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            return await ctx.send(embed=embed)
        track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Track not found.")
            return await ctx.send(embed=embed)
            
        res = await spotify_like_track(session, str(ctx.author.id), track['id'])
        if res is True:
            view = get_spotify_remote_layout(track, ctx.author.id, "Liked")
            await ctx.send(view=view)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await ctx.send(embed=embed)

    @commands.command(aliases=['ru', 'rcul', 'spotifyunlike'])
    async def rcunlike(self, ctx, *, query: str = None):
        session = self.bot.session
        if not query:
            # fmbot parity: default to the track currently playing.
            current = await get_currently_playing_track(session, str(ctx.author.id))
            if current == "no_token":
                return await ctx.send(embed=_link_required_embed(ctx.author.id))
            if not current:
                embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to unlike.")
                return await ctx.send(embed=embed)
            track = current
        else:
            track = await search_spotify_track(session, query)
        if not track: 
            embed = discord.Embed(color=0xFF0000, description="❌ Track not found.")
            return await ctx.send(embed=embed)
            
        res = await spotify_unlike_track(session, str(ctx.author.id), track['id'])
        if res is True:
            view = get_spotify_remote_layout(track, ctx.author.id, "Unliked")
            await ctx.send(view=view)
        else:
            embed = discord.Embed(color=0xFF0000, description=_pretty_spotify_error(res))
            await ctx.send(embed=embed)

    async def _current_spotify_or_lastfm(self, ctx):
        """(artist, song, album) for what's playing now, via Spotify or Last.fm.

        No Spotify link required — like fmbot, this works off Last.fm alone.
        """
        session = self.bot.session
        try:
            current = await get_currently_playing_track(session, str(ctx.author.id))
            if current and current != "no_token":
                artists = current.get("artists") or []
                return (artists[0] if artists else None, current.get("name"), current.get("album_name"), current)
        except Exception:
            pass
        try:
            from src.core.events import get_lastfm_username
            from src.utils.api import fetch_now_playing
            username = await get_lastfm_username(ctx.author.id)
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

    async def _send_spotify_link(self, ctx, kind, info):
        url = (info or {}).get("spotify_url")
        if not url:
            embed = discord.Embed(color=0xFF0000, description=f"❌ Could not find that {kind} on Spotify.")
            return await ctx.send(embed=embed)
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
        await ctx.send(embed=embed)

    @commands.command(name="spotify", aliases=['sp'])
    async def spotify_link(self, ctx, *, query: str = None):
        """Spotify link for your current track, or search. No link required."""
        session = self.bot.session
        if not query:
            artist, song, _album, current = await self._current_spotify_or_lastfm(ctx)
            if current and current.get("spotify_url"):
                return await self._send_spotify_link(ctx, "track", current)
            if not song:
                embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me a track to look up. (Link Last.fm with `,login` for automatic detection.)")
                return await ctx.send(embed=embed)
            info = await search_spotify_track(session, f"{song} {artist or ''}".strip())
            if not info:
                embed = discord.Embed(color=0xFF0000, description="❌ Could not find that track on Spotify.")
                return await ctx.send(embed=embed)
            return await self._send_spotify_link(ctx, "track", info)

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description=resolved["error"]))
        if resolved["kind"] != "track":
            kind = resolved["kind"]
            hint = "`,spab`" if kind == "album" else "`,spa`"
            embed = discord.Embed(color=0xFF0000, description=f"That's an {kind} — use {hint} for {kind} links.")
            return await ctx.send(embed=embed)
        await self._send_spotify_link(ctx, "track", resolved["info"])

    @commands.command(name="spotifyalbum", aliases=['spab'])
    async def spotify_album_link(self, ctx, *, query: str = None):
        """Spotify link for your current album, or search. No link required."""
        session = self.bot.session
        if not query:
            artist, _song, album, _current = await self._current_spotify_or_lastfm(ctx)
            if not album:
                embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me an album to look up.")
                return await ctx.send(embed=embed)
            info = await search_spotify_album(session, f"{album} {artist or ''}".strip())
            if not info:
                embed = discord.Embed(color=0xFF0000, description="❌ Could not find that album on Spotify.")
                return await ctx.send(embed=embed)
            return await self._send_spotify_link(ctx, "album", info)

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description=resolved["error"]))
        kind, info = resolved["kind"], resolved["info"]
        if kind == "album":
            return await self._send_spotify_link(ctx, "album", info)
        # A track resolves to its album; an artist needs a specific album name.
        if kind == "track" and info.get("album_name"):
            artists = info.get("artists") or []
            album_info = await search_spotify_album(session, f"{info['album_name']} {artists[0] if artists else ''}".strip())
            if album_info:
                return await self._send_spotify_link(ctx, "album", album_info)
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description="❌ Could not find that album on Spotify."))
        return await ctx.send(embed=discord.Embed(color=0xFF0000, description="That's an artist — which album? Try `,spab <album>."))

    @commands.command(name="spotifyartist", aliases=['spa'])
    async def spotify_artist_link(self, ctx, *, query: str = None):
        """Spotify link for your current artist, or search. No link required."""
        session = self.bot.session
        if not query:
            artist, _song, _album, _current = await self._current_spotify_or_lastfm(ctx)
            if not artist:
                embed = discord.Embed(color=0xFF0000, description="❌ Nothing is playing — give me an artist to look up.")
                return await ctx.send(embed=embed)
            info = await search_spotify_artist_full(session, artist)
            if not info:
                embed = discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify.")
                return await ctx.send(embed=embed)
            return await self._send_spotify_link(ctx, "artist", info)

        resolved = await _resolve_spotify_input(session, query)
        if "error" in resolved:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description=resolved["error"]))
        kind, info = resolved["kind"], resolved["info"]
        if kind == "artist":
            return await self._send_spotify_link(ctx, "artist", info)
        artists = info.get("artists") or []
        if not artists:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify."))
        artist_info = await search_spotify_artist_full(session, artists[0])
        if not artist_info:
            return await ctx.send(embed=discord.Embed(color=0xFF0000, description="❌ Could not find that artist on Spotify."))
        await self._send_spotify_link(ctx, "artist", artist_info)

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
