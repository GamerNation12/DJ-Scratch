from src.core.theme import Theme
from src.core.config import Log
import discord
from discord.ext import commands
from discord import app_commands

from src.core.database import format_name


async def get_target_user(ctx, arg_string: str = None):
    target_user = ctx.author
    
    if hasattr(ctx.message, 'reference') and ctx.message.reference and ctx.message.reference.message_id:
        try:
            if hasattr(ctx.message.reference, 'resolved') and isinstance(ctx.message.reference.resolved, discord.Message):
                target_user = ctx.message.reference.resolved.author
            elif ctx.message.reference.cached_message:
                target_user = ctx.message.reference.cached_message.author
            else:
                msg = await ctx.channel.fetch_message(ctx.message.reference.message_id)
                target_user = msg.author
        except Exception:
            pass

    if ctx.message.mentions:
        for m in ctx.message.mentions:
            if not m.bot or m.id == ctx.bot.user.id:
                target_user = m
                break

    cleaned_args = arg_string
    if cleaned_args and ctx.message.mentions:
        for m in ctx.message.mentions:
            cleaned_args = cleaned_args.replace(f'<@{m.id}>', '').replace(f'<@!{m.id}>', '').strip()
        if not cleaned_args:
            cleaned_args = None
            
    return target_user, cleaned_args



class LastFmCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _reply_and_delete(self, ctx, *args, **kwargs):
        kwargs['mention_author'] = False
        try:
            msg = await ctx.reply(*args, **kwargs)
        except Exception:
            kwargs.pop('mention_author', None)
            msg = await ctx.send(*args, **kwargs)
        
        try:
            await ctx.message.delete()
        except Exception:
            pass
        return msg

    @app_commands.command(name="cd", description="Check the bot's avatar cooldown and preview avatar")
    @app_commands.describe(last_song="Fetch the last completed song instead of the currently playing song")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def cd_slash(self, interaction: discord.Interaction, last_song: bool = False):
        await interaction.response.defer(ephemeral=True)
        cd = await self.bot.get_avatar_cooldown()
        status_msg = f"⏳ Avatar is on cooldown for **{cd//60}m {cd%60}s**." if cd > 0 else "✅ Avatar is **ready** to be updated!"
        from src.core.events import get_lastfm_username, ApplyAvatarView, LASTFM_COLOR
        from src.utils.api import api_get, LASTFM_API_KEY
        try:
            username = await get_lastfm_username(interaction.user.id)
            if username:
                url = f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={username}&api_key={LASTFM_API_KEY}&format=json&limit=2"
                data = await api_get(url)
                if data and 'recenttracks' in data and data['recenttracks']['track']:
                    tracks = data['recenttracks']['track']
                    t = tracks[0]
                    is_p = t.get('@attr', {}).get('nowplaying') == 'true'
                    
                    if last_song:
                        if is_p and len(tracks) > 1:
                            t = tracks[1]
                        is_p = True 
                    
                    if is_p:
                        artist, song, img = t['artist']['#text'], t['name'], t['image'][3]['#text']
                        album = t.get('album', {}).get('#text')
                        
                        try:
                            from src.core.spotify import get_spotify_track_info
                            session = getattr(self.bot, 'session', None)
                            if session:
                                s_info = await get_spotify_track_info(session, artist, song)
                                if s_info and s_info.get("image_url"):
                                    if not img or "2a96cbd8b46e442fc41c2b86b821562f" in img:
                                        img = s_info.get("image_url")
                        except Exception as e:
                            print(f"{Log.RED}>>> Spotify fetch error in cd_slash: {e}{Log.RESET}")

                        if img:
                            title = "Bot Avatar Preview (Last Played)" if last_song else "Bot Avatar Preview"
                            desc = f"Last track: **{song}** by **{artist}**" if last_song else f"Current track: **{song}** by **{artist}**"
                            preview_embed = Theme.get_embed(
                                title=title, 
                                description=desc, 
                                color=LASTFM_COLOR
                            )
                            preview_embed.set_author(name=format_name(interaction.user), icon_url=img)
                            preview_embed.set_image(url=img)
                            
                            view = ApplyAvatarView(self.bot, artist, img, original_user=interaction.user, track=song, album=album)
                            msg = await interaction.followup.send(content=status_msg, embed=preview_embed, view=view, ephemeral=True, wait=True)
                            view.original_msg = msg
                            return
        except Exception as e:
            pass
            
        await interaction.followup.send(content=status_msg, ephemeral=True)

    @app_commands.command(name="privacy", description="Toggle privacy mode to hide your profile from public stats")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def privacy_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        await self.toggle_privacy(interaction.user, interaction.followup.send)

    @commands.command(name="privacy", aliases=["pr", "priv"])
    async def privacy_prefix(self, ctx):
        await self.toggle_privacy(ctx.author, ctx.reply)

    async def toggle_privacy(self, user: discord.User, send_func):
        from src.core.events import db_pool
        if db_pool:
            try:
                async with db_pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT private_mode FROM user_settings WHERE user_id=$1", str(user.id))
                    current = row['private_mode'] if row and 'private_mode' in row else False
                    new_state = not current
                    await conn.execute("""
                        INSERT INTO user_settings (user_id, private_mode) 
                        VALUES ($1, $2) 
                        ON CONFLICT (user_id) 
                        DO UPDATE SET private_mode=$2
                    """, str(user.id), new_state)
                    
                    state_str = "Enabled" if new_state else "Disabled"
                    desc = "Your profile is now hidden from the public dashboard and server stats." if new_state else "Your profile is now visible on the public dashboard and server stats."
                    color = discord.Color.red() if new_state else discord.Color.green()
                    
                    embed = Theme.get_embed(title=f"🔒 Privacy Mode {state_str}", description=desc, color=color)
                    await send_func(embed=embed)
            except Exception as e:
                print(f"Privacy toggle error: {e}")
                await send_func(content="Failed to update privacy settings. Please try again.")
        else:
            await send_func(content="Database is not available right now. Please try again later.")

    @app_commands.command(name="login", description="Securely login and link your Last.fm account")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def login_slash(self, interaction: discord.Interaction):
        from src.core.events import get_lastfm_username
        username = await get_lastfm_username(interaction.user.id)
        if username:
            embed = Theme.get_embed(
                title="✅ Already Logged In",
                description=f"You are currently logged in as **{username}**.\n\nIf you want to switch accounts, please use the `/logout` command first.",
                color=discord.Color.green()
            )
            return await interaction.response.send_message(embed=embed, ephemeral=True)
            
        embed = Theme.get_embed(
            title="🔗 Connect Last.fm",
            description="Click the button below to securely link your Last.fm account. You will be redirected to Last.fm to authorize the bot.",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)
        msg = await interaction.original_response()
        
        import urllib.parse, os
        api_key = os.getenv("LASTFM_API_KEY", "eee299142ac5fe73e5eb5dcd1c29bcae")
        cb_url = f"https://dj-scratch.vercel.app/login-callback/?discord_id={interaction.user.id}&channel_id={interaction.channel_id}&message_id={msg.id}"
        auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={urllib.parse.quote(cb_url)}"
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Login with Last.fm", url=auth_url, emoji="🔗"))
        await interaction.edit_original_response(view=view)

    @app_commands.command(name="logout", description="Unlink your Last.fm account from the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def logout_slash(self, interaction: discord.Interaction):
        from src.core.database import unlink_user
        await unlink_user(interaction.user.id)
        embed = Theme.get_embed(
            title="👋 Logged Out",
            description="Your Last.fm account has been successfully unlinked from your Discord account.",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

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
        await interaction.response.defer()
        if mode is not None:
            m = mode.value
        else:
            m = await self.bot.get_user_fm_mode(interaction.user.id)
            if not m: m = "full"
        
        result, is_p = await self.bot.process_fm(interaction, interaction.user, mode=m)
        if result is None:
            await interaction.edit_original_response(content=is_p)
        elif isinstance(result, dict):
            msg = await interaction.edit_original_response(**result)
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
        embed, view, err = await self.bot.process_top_artists(interaction.user, period.value if period else 'all')
        if embed:
            await interaction.edit_original_response(embed=embed, view=view)
        else:
            await interaction.edit_original_response(content=err)

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
        embed, view, err = await self.bot.process_top_tracks(interaction.user, period.value if period else 'all')
        if embed:
            await interaction.edit_original_response(embed=embed, view=view)
        else:
            await interaction.edit_original_response(content=err)

    @app_commands.command(name="recent", description="View your recent listening history")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def rt_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_recent(interaction.user)
        await interaction.edit_original_response(embed=embed) if embed else await interaction.edit_original_response(content=err)

    @app_commands.command(name="artisttracks", description="View your top played tracks for a specific artist")
    @app_commands.describe(artist="The artist to check (leave blank to use current playing artist)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def at_slash(self, interaction: discord.Interaction, artist: str = None):
        await interaction.response.defer()
        embed, view, err = await self.bot.process_artist_tracks(interaction.user, artist)
        if err:
            await interaction.edit_original_response(content=err)
        else:
            await interaction.edit_original_response(embed=embed, view=view)


    @app_commands.command(name="profile", description="View your Last.fm stats")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def profile_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, view, err = await self.bot.process_profile(interaction.user)
        if embed:
            if view:
                await interaction.edit_original_response(embed=embed, view=view)
            else:
                await interaction.edit_original_response(embed=embed)
        else:
            await interaction.edit_original_response(content=err)

    @app_commands.command(name="whoknows", description="See who in the server listens to an artist most")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def wk_slash(self, interaction: discord.Interaction, artist: str = None):
        await interaction.response.defer()
        embed, err = await self.bot.process_whoknows(interaction.guild, interaction.user, artist)
        await interaction.edit_original_response(embed=embed) if embed else await interaction.edit_original_response(content=err)

    @app_commands.command(name="suggest", description="Send a suggestion directly to the developer")
    @app_commands.describe(suggestion="Your idea or feedback for the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def suggest_slash(self, interaction: discord.Interaction, suggestion: str):
        await self.bot.process_suggestion(interaction, interaction.user, suggestion)

    @app_commands.command(name="bug", description="Report a bug directly to the developer")
    @app_commands.describe(bug="Describe the bug you found in the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def bug_slash(self, interaction: discord.Interaction, bug: str):
        await self.bot.process_suggestion(interaction, interaction.user, bug, is_bug=True)

    @app_commands.command(name="help", description="View all available commands")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def help_slash(self, interaction: discord.Interaction):
        embed, view = self.bot.get_help_embed(interaction.user, self.bot.user)
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="crowns", description="See which of your top artists you have the most plays for")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def crowns_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_crowns(interaction.guild, interaction.user)
        await interaction.edit_original_response(embed=embed) if embed else await interaction.edit_original_response(content=err)

    @app_commands.command(name="judge", description="Let an AI judge your recent music taste")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def judge_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_judge(interaction.user)
        await interaction.edit_original_response(embed=embed) if embed else await interaction.edit_original_response(content=err)

    # --- PREFIX COMMANDS ---

    @commands.command(name="cd", aliases=["cooldown"])
    async def cd_prefix(self, ctx):
        cd = await self.bot.get_avatar_cooldown()
        status_msg = f"⏳ Avatar is on cooldown for **{cd//60}m {cd%60}s**." if cd > 0 else "✅ Avatar is **ready** to be updated!"

        from src.core.events import fetch_now_playing, get_lastfm_username, ApplyAvatarView, LASTFM_COLOR
        try:
            username = await get_lastfm_username(ctx.author.id)
            if username:
                data = await fetch_now_playing(username)
                if data and 'recenttracks' in data and data['recenttracks']['track']:
                    t = data['recenttracks']['track'][0]
                    is_p = t.get('@attr', {}).get('nowplaying') == 'true'
                    if is_p:
                        artist, song, img = t['artist']['#text'], t['name'], t['image'][3]['#text']
                        album = t.get('album', {}).get('#text')
                        
                        try:
                            from src.core.spotify import get_spotify_track_info
                            session = getattr(self.bot, 'session', None)
                            if session:
                                s_info = await get_spotify_track_info(session, artist, song)
                                if s_info and s_info.get("image_url"):
                                    if not img or "2a96cbd8b46e442fc41c2b86b821562f" in img:
                                        img = s_info.get("image_url")
                        except Exception as e:
                            print(f"{Log.RED}>>> Spotify fetch error in cd_prefix: {e}{Log.RESET}")

                        if img:
                            preview_embed = Theme.get_embed(
                                title="Bot Avatar Preview", 
                                description=f"Current track: **{song}** by **{artist}**", 
                                color=LASTFM_COLOR
                            )
                            preview_embed.set_author(name=format_name(ctx.author), icon_url=img)
                            preview_embed.set_image(url=img)
                            
                            view = ApplyAvatarView(self.bot, artist, img, original_user=ctx.author, track=song, album=album)
                            msg = await ctx.send(content=status_msg, embed=preview_embed, view=view)
                            view.original_msg = msg
                            return
        except Exception as e:
            pass
            
        await ctx.send(content=status_msg)

    @commands.command(name="cd2", aliases=["c2"])
    async def cd2_prefix(self, ctx):
        cd = await self.bot.get_avatar_cooldown()
        status_msg = f"⏳ Avatar is on cooldown for **{cd//60}m {cd%60}s**." if cd > 0 else "✅ Avatar is **ready** to be updated!"

        from src.core.events import get_lastfm_username, ApplyAvatarView, LASTFM_COLOR
        from src.utils.api import api_get, LASTFM_API_KEY
        try:
            username = await get_lastfm_username(ctx.author.id)
            if username:
                # Fetch limit=2 to ensure we get the last completed song even if one is currently playing
                url = f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={username}&api_key={LASTFM_API_KEY}&format=json&limit=2"
                data = await api_get(url)
                if data and 'recenttracks' in data and data['recenttracks']['track']:
                    tracks = data['recenttracks']['track']
                    # Default to the first track
                    t = tracks[0]
                    # If the first track is currently playing and there is a second track, use the second track (last completed)
                    if t.get('@attr', {}).get('nowplaying') == 'true' and len(tracks) > 1:
                        t = tracks[1]
                        
                    artist, song, img = t['artist']['#text'], t['name'], t['image'][3]['#text']
                    album = t.get('album', {}).get('#text')
                    
                    try:
                        from src.core.spotify import get_spotify_track_info
                        session = getattr(self.bot, 'session', None)
                        if session:
                            s_info = await get_spotify_track_info(session, artist, song)
                            if s_info and s_info.get("image_url"):
                                if not img or "2a96cbd8b46e442fc41c2b86b821562f" in img:
                                    img = s_info.get("image_url")
                    except Exception as e:
                        print(f"{Log.RED}>>> Spotify fetch error in cd2_prefix: {e}{Log.RESET}")

                    if img:
                        preview_embed = Theme.get_embed(
                            title="Bot Avatar Preview (Last Played)", 
                            description=f"Last track: **{song}** by **{artist}**", 
                            color=LASTFM_COLOR
                        )
                        preview_embed.set_author(name=format_name(ctx.author), icon_url=img)
                        preview_embed.set_image(url=img)
                        
                        view = ApplyAvatarView(self.bot, artist, img, original_user=ctx.author, track=song, album=album)
                        msg = await ctx.send(content=status_msg, embed=preview_embed, view=view)
                        view.original_msg = msg
                        return
        except Exception as e:
            pass
            
        await ctx.send(content=status_msg)

    @commands.command(name="login", aliases=["log", "li"])
    async def login_prefix(self, ctx):
        from src.core.events import get_lastfm_username
        username = await get_lastfm_username(ctx.author.id)
        if username:
            embed = Theme.get_embed(
                title="✅ Already Logged In",
                description=f"You are currently logged in as **{username}**.\n\nIf you want to switch accounts, please use the `,logout` command first.",
                color=discord.Color.green()
            )
            return await ctx.send(embed=embed)
            
        embed = Theme.get_embed(
            title="🔗 Connect Last.fm",
            description="Click the button below to securely link your Last.fm account. You will be redirected to Last.fm to authorize the bot.",
            color=discord.Color.red()
        )
        msg = await ctx.send(embed=embed)
        
        import urllib.parse, os
        api_key = os.getenv("LASTFM_API_KEY", "eee299142ac5fe73e5eb5dcd1c29bcae")
        cb_url = f"https://dj-scratch.vercel.app/login-callback/?discord_id={ctx.author.id}&channel_id={ctx.channel.id}&message_id={msg.id}"
        auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={urllib.parse.quote(cb_url)}"
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Login with Last.fm", url=auth_url, emoji="🔗"))
        await msg.edit(view=view)

    @commands.command(name="logout", aliases=["lo"])
    async def logout_prefix(self, ctx):
        from src.core.database import unlink_user
        await unlink_user(ctx.author.id)
        embed = Theme.get_embed(
            title="👋 Logged Out",
            description="Your Last.fm account has been successfully unlinked from your Discord account.",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command(name="fm", aliases=["np", "nowplaying", "fm1", "fm2", "fm3", "np1", "np2", "np3", "n", "fn"])
    async def fm_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        invoked = ctx.invoked_with
        if invoked in ["fm1", "np1"]: m = "compact"
        elif invoked in ["fm2", "np2"]: m = "full"
        elif invoked in ["fm3", "np3"]: m = "stats"
        else:
            m = await self.bot.get_user_fm_mode(target_user.id)
            if not m: m = "full"
        result, is_p = await self.bot.process_fm(ctx, target_user, mode=m)
        if result is None:
            await self._reply_and_delete(ctx, is_p)
        elif isinstance(result, dict):
            msg = await self._reply_and_delete(ctx, **result)
            if is_p: await self.bot.add_custom_reactions(msg)

    @commands.command(name="ta", aliases=["topartists", "topa", "tart"])
    async def ta_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'all'
        embed, view, err = await self.bot.process_top_artists(target_user, period)
        if embed:
            await self._reply_and_delete(ctx, embed=embed, view=view)
        else:
            await self._reply_and_delete(ctx, err)

    @commands.command(name="tt", aliases=["toptracks", "topt", "ttr", "ttracks"])
    async def tt_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'all'
        embed, view, err = await self.bot.process_top_tracks(target_user, period)
        if embed:
            await self._reply_and_delete(ctx, embed=embed, view=view)
        else:
            await self._reply_and_delete(ctx, err)

    @commands.command(name="rt", aliases=["recent", "recents", "rtracks", "r"])
    async def rt_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_recent(target_user)
        await self._reply_and_delete(ctx, embed=embed) if embed else await self._reply_and_delete(ctx, err)

    @commands.command(name="at", aliases=["artisttracks", "art", "atracks"])
    async def at_prefix(self, ctx, *, args: str = None):
        target_user, artist = await get_target_user(ctx, args)
        embed, view, err = await self.bot.process_artist_tracks(target_user, artist)
        if err:
            await self._reply_and_delete(ctx, err)
        else:
            await self._reply_and_delete(ctx, embed=embed, view=view)


    @commands.command(name="profile", aliases=["prof"])
    async def s_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, view, err = await self.bot.process_profile(target_user)
        if embed:
            if view:
                await self._reply_and_delete(ctx, embed=embed, view=view)
            else:
                await self._reply_and_delete(ctx, embed=embed)
        else:
            await self._reply_and_delete(ctx, err)

    @commands.command(name="wk", aliases=["whoknows", "who", "w"])
    async def wk_prefix(self, ctx, *, args: str = None):
        target_user, artist = await get_target_user(ctx, args)
        embed, err = await self.bot.process_whoknows(ctx.guild, target_user, artist)
        await self._reply_and_delete(ctx, embed=embed) if embed else await self._reply_and_delete(ctx, err)

    @commands.command(name="suggest", aliases=["suggestion", "su", "sug"])
    async def suggest_prefix(self, ctx, *, suggestion: str = None):
        if not suggestion:
            embed = Theme.get_embed(
                title="❌ Missing Suggestion", 
                description="Please provide a suggestion!\n\n**Usage:** `,suggest <your idea>`",
                color=discord.Color.red()
            )
            return await ctx.send(embed=embed)
        await self.bot.process_suggestion(ctx, ctx.author, suggestion)

    @commands.command(name="bug", aliases=["bugreport", "reportbug"])
    async def bug_prefix(self, ctx, *, bug: str = None):
        if not bug:
            embed = Theme.get_embed(
                title="❌ Missing Bug Report", 
                description="Please describe the bug!\n\n**Usage:** `,bug <description>`",
                color=discord.Color.red()
            )
            return await ctx.send(embed=embed)
        await self.bot.process_suggestion(ctx, ctx.author, bug, is_bug=True)

    @commands.command(name="help", aliases=["h"])
    async def help_prefix(self, ctx):
        embed, view = self.bot.get_help_embed(ctx.author, self.bot.user)
        await ctx.send(embed=embed, view=view)

    @commands.command(name="crowns", aliases=["cr", "cw"])
    async def crowns_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_crowns(ctx.guild, target_user)
        await self._reply_and_delete(ctx, embed=embed) if embed else await self._reply_and_delete(ctx, err)

    @commands.command(name="judge", aliases=["roast", "jd", "j"])
    async def judge_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_judge(target_user)
        await self._reply_and_delete(ctx, embed=embed) if embed else await self._reply_and_delete(ctx, err)

    @commands.command(name="receipt", aliases=["rec", "re"])
    async def receipt_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'overall'
        # Map period aliases
        period_map = {'7d': '7day', '1m': '1month', '3m': '3month', '6m': '6month', '12m': '12month', 'y': '12month', 'all': 'overall'}
        p = period_map.get(period.lower(), period.lower())
            
        embed, file, err = await self.bot.process_receipt(target_user, p, 10)
        if err:
            await self._reply_and_delete(ctx, err)
        else:
            await self._reply_and_delete(ctx, embed=embed, file=file)



async def setup(bot):
    await bot.add_cog(LastFmCog(bot))
