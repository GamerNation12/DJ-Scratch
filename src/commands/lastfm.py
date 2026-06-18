import discord
from discord.ext import commands
from discord import app_commands

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
            if not m.bot:
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

    @app_commands.command(name="cd", description="Check the bot's avatar cooldown and preview avatar")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def cd_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        cd = await self.bot.get_avatar_cooldown()
        status_msg = f"⏳ Avatar is on cooldown for **{cd//60}m {cd%60}s**." if cd > 0 else "✅ Avatar is **ready** to be updated!"

        from src.core.events import fetch_now_playing, get_lastfm_username, ApplyAvatarView, LASTFM_COLOR
        try:
            username = await get_lastfm_username(interaction.user.id)
            if username:
                data = await fetch_now_playing(username)
                if data and 'recenttracks' in data and data['recenttracks']['track']:
                    t = data['recenttracks']['track'][0]
                    is_p = t.get('@attr', {}).get('nowplaying') == 'true'
                    if is_p:
                        artist, song, img = t['artist']['#text'], t['name'], t['image'][3]['#text']
                        if img:
                            preview_embed = discord.Embed(
                                title="Bot Avatar Preview", 
                                description=f"Current track: **{song}** by **{artist}**", 
                                color=LASTFM_COLOR
                            )
                            preview_embed.set_author(name=self.bot.user.name, icon_url=img)
                            preview_embed.set_image(url=img)
                            
                            view = ApplyAvatarView(self.bot, artist, img, original_user=interaction.user)
                            msg = await interaction.followup.send(content=status_msg, embed=preview_embed, view=view, ephemeral=True)
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

    @commands.command(name="privacy")
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
                    
                    embed = discord.Embed(title=f"🔒 Privacy Mode {state_str}", description=desc, color=color)
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
        import urllib.parse, os
        api_key = os.getenv("LASTFM_API_KEY", "696438a21fc540d4cb27faa736239e75")
        cb_url = f"https://the-goats-dj.hostedbyfps.com/api/auth/lastfm/callback?discord_id={interaction.user.id}"
        auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={urllib.parse.quote(cb_url)}"
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Login with Last.fm", url=auth_url, emoji="🔗"))
        
        embed = discord.Embed(
            title="🔗 Connect Last.fm",
            description="Click the button below to securely link your Last.fm account. You will be redirected to Last.fm to authorize the bot.",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

    @app_commands.command(name="setfm", description="Manually link your Last.fm username to the bot")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def setfm_slash(self, interaction: discord.Interaction, username: str):
        import re
        user_name = re.sub(r'^(?:<)?https?:\/\/(?:www\.)?last\.fm\/user\/([^\/\s>]+).*$', r'\1', username.strip(), flags=re.IGNORECASE)
        user_name = user_name.replace("/", "").strip()
        await self.bot.save_user(interaction.user.id, user_name)
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
        embed, view, err = await self.bot.process_top_artists(interaction.user, period.value if period else 'all')
        if embed:
            await interaction.followup.send(embed=embed, view=view)
        else:
            await interaction.followup.send(err)

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
            await interaction.followup.send(embed=embed, view=view)
        else:
            await interaction.followup.send(err)

    @app_commands.command(name="recent", description="View your recent listening history")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def rt_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_recent(interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="artisttracks", description="View your top played tracks for a specific artist")
    @app_commands.describe(artist="The artist to check (leave blank to use current playing artist)")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def at_slash(self, interaction: discord.Interaction, artist: str = None):
        await interaction.response.defer()
        embed, view, err = await self.bot.process_artist_tracks(interaction.user, artist)
        if err:
            await interaction.followup.send(err)
        else:
            await interaction.followup.send(embed=embed, view=view)


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
        embed, view = self.bot.get_help_embed(interaction.user)
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="crowns", description="See which of your top artists you have the most plays for")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def crowns_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_crowns(interaction.guild, interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

    @app_commands.command(name="judge", description="Let an AI judge your recent music taste")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def judge_slash(self, interaction: discord.Interaction):
        await interaction.response.defer()
        embed, err = await self.bot.process_judge(interaction.user)
        await interaction.followup.send(embed=embed) if embed else await interaction.followup.send(err)

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
                        if img:
                            preview_embed = discord.Embed(
                                title="Bot Avatar Preview", 
                                description=f"Current track: **{song}** by **{artist}**", 
                                color=LASTFM_COLOR
                            )
                            preview_embed.set_author(name=self.bot.user.name, icon_url=img)
                            preview_embed.set_image(url=img)
                            
                            view = ApplyAvatarView(self.bot, artist, img, original_user=ctx.author)
                            msg = await ctx.send(content=status_msg, embed=preview_embed, view=view)
                            view.original_msg = msg
                            return
        except Exception as e:
            pass
            
        await ctx.send(content=status_msg)

    @commands.command(name="login")
    async def login_prefix(self, ctx):
        import urllib.parse, os
        api_key = os.getenv("LASTFM_API_KEY", "696438a21fc540d4cb27faa736239e75")
        cb_url = f"https://the-goats-dj.hostedbyfps.com/api/auth/lastfm/callback?discord_id={ctx.author.id}"
        auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={urllib.parse.quote(cb_url)}"
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Login with Last.fm", url=auth_url, emoji="🔗"))
        
        embed = discord.Embed(
            title="🔗 Connect Last.fm",
            description="Click the button below to securely link your Last.fm account. You will be redirected to Last.fm to authorize the bot.",
            color=discord.Color.red()
        )
        await ctx.send(embed=embed, view=view)

    @commands.command(name="setfm")
    async def setfm_prefix(self, ctx, *, username: str = None):
        if not username:
            import urllib.parse, os
            api_key = os.getenv("LASTFM_API_KEY", "696438a21fc540d4cb27faa736239e75")
            cb_url = f"https://the-goats-dj.hostedbyfps.com/api/auth/lastfm/callback?discord_id={ctx.author.id}"
            auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={urllib.parse.quote(cb_url)}"
            
            view = discord.ui.View()
            view.add_item(discord.ui.Button(label="Login with Last.fm", url=auth_url, emoji="🔗"))
            
            embed = discord.Embed(
                title="❌ Missing Username", 
                description="Please provide your Last.fm username or profile link!\n\n**Usage:** `,setfm <username>`\n\nAlternatively, you can securely log in via the button below:",
                color=discord.Color.red()
            )
            return await ctx.send(embed=embed, view=view)
            
        import re
        user_name = re.sub(r'^(?:<)?https?:\/\/(?:www\.)?last\.fm\/user\/([^\/\s>]+).*$', r'\1', username.strip(), flags=re.IGNORECASE)
        user_name = user_name.replace("/", "").strip()
        await self.bot.save_user(ctx.author.id, user_name)
        await ctx.send(f"✅ Linked your Discord to Last.fm account: **{user_name}**")

    @commands.command(name="fm", aliases=["np", "nowplaying", "fm1", "fm2", "fm3", "np1", "np2", "np3"])
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
        if result is None: await ctx.send(is_p)
        elif isinstance(result, dict):
            msg = await ctx.send(**result)
            if is_p: await self.bot.add_custom_reactions(msg)

    @commands.command(name="ta", aliases=["topartists"])
    async def ta_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'all'
        embed, view, err = await self.bot.process_top_artists(target_user, period)
        if embed:
            await ctx.send(embed=embed, view=view)
        else:
            await ctx.send(err)

    @commands.command(name="tt", aliases=["toptracks"])
    async def tt_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'all'
        embed, view, err = await self.bot.process_top_tracks(target_user, period)
        if embed:
            await ctx.send(embed=embed, view=view)
        else:
            await ctx.send(err)

    @commands.command(name="rt", aliases=["recent"])
    async def rt_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_recent(target_user)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="at", aliases=["artisttracks"])
    async def at_prefix(self, ctx, *, args: str = None):
        target_user, artist = await get_target_user(ctx, args)
        embed, view, err = await self.bot.process_artist_tracks(target_user, artist)
        if err:
            await ctx.send(err)
        else:
            await ctx.send(embed=embed, view=view)


    @commands.command(name="s", aliases=["profile"])
    async def s_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_profile(target_user)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="wk", aliases=["whoknows"])
    async def wk_prefix(self, ctx, *, args: str = None):
        target_user, artist = await get_target_user(ctx, args)
        embed, err = await self.bot.process_whoknows(ctx.guild, target_user, artist)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="suggest", aliases=["suggestion"])
    async def suggest_prefix(self, ctx, *, suggestion: str = None):
        if not suggestion:
            embed = discord.Embed(
                title="❌ Missing Suggestion", 
                description="Please provide a suggestion!\n\n**Usage:** `,suggest <your idea>`",
                color=discord.Color.red()
            )
            return await ctx.send(embed=embed)
        await self.bot.process_suggestion(ctx, ctx.author, suggestion)

    @commands.command(name="help")
    async def help_prefix(self, ctx):
        embed, view = self.bot.get_help_embed(ctx.author)
        await ctx.send(embed=embed, view=view)

    @commands.command(name="crowns")
    async def crowns_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_crowns(ctx.guild, target_user)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="judge", aliases=["roast"])
    async def judge_prefix(self, ctx, *, args: str = None):
        target_user, _ = await get_target_user(ctx, args)
        embed, err = await self.bot.process_judge(target_user)
        await ctx.send(embed=embed) if embed else await ctx.send(err)

    @commands.command(name="receipt")
    async def receipt_prefix(self, ctx, *, args: str = None):
        target_user, period = await get_target_user(ctx, args)
        if not period: period = 'overall'
        # Map period aliases
        period_map = {'7d': '7day', '1m': '1month', '3m': '3month', '6m': '6month', '12m': '12month', 'y': '12month', 'all': 'overall'}
        p = period_map.get(period.lower(), period.lower())
        
        embed, file, err = await self.bot.process_receipt(target_user, p, 10)
        if err:
            await ctx.send(err)
        else:
            await ctx.send(embed=embed, file=file)



async def setup(bot):
    await bot.add_cog(LastFmCog(bot))
