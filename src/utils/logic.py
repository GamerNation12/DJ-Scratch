import discord
from datetime import datetime, timedelta
from ..core.config import LASTFM_COLOR
from .api import *

async def process_fm(ctx_int, user, mode="full"):
    username = get_lastfm_username(user.id)
    if not username: return None, "Link Last.fm with `/setfm [username]`"
    
    data = await fetch_now_playing(username, 2 if mode == 'stats' else 1)
    if not data or 'recenttracks' not in data or not data['recenttracks']['track']: 
        return None, "Could not find recent tracks."
    
    try:
        tracks = data['recenttracks']['track']
        t = tracks[0]
        artist, song, album, img = t['artist']['#text'], t['name'], t['album']['#text'], t['image'][3]['#text']
        
        show_features = await get_user_show_features(user.id)
        if show_features:
            artist, song = await apply_features(bot.session, artist, song)
                
        track_url = t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(artist)}/_/{urllib.parse.quote(song)}")
        is_p = t.get('@attr', {}).get('nowplaying') == 'true'
        status = "Now Playing" if is_p else "Last Played"
        color = LASTFM_COLOR if is_p else discord.Color.dark_gray()

        changed, cd = await update_bot_avatar_and_status(artist, img) if is_p else (False, 0)

        if mode == "compact":
            if is_p:
                content = f"<a:movingnotes:1476084305229910159> **{user.display_name}** is listening to **[{song}](<{track_url}>)** by **{artist}**"
            else:
                content = f"🎧 **{user.display_name}** was listening to **[{song}](<{track_url}>)** by **{artist}**"
            
            desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
            embed = discord.Embed(description=desc, color=color)
            embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
            if img: embed.set_thumbnail(url=img)
            embed.set_footer(text=f"Scrobbling as {username}")
            return {"content": content, "view": MoreInfoView(embed)}, is_p

        if mode == "stats":
            desc_lines = [f"**[{song}]({track_url})**", f"**{artist}** • *{album}*"]
            
            if len(tracks) > 1:
                prev_t = tracks[1]
                p_artist, p_song, p_album = prev_t['artist']['#text'], prev_t['name'], prev_t['album']['#text']
                
                if show_features:
                    p_artist, p_song = await apply_features(bot.session, p_artist, p_song)
                
                p_url = prev_t.get('url', f"https://www.last.fm/music/{urllib.parse.quote(p_artist)}/_/{urllib.parse.quote(p_song)}")
                desc_lines.extend(["", "Previous:", f"**[{p_song}]({p_url})**", f"**{p_artist}** • *{p_album}*"])
            
            embed = discord.Embed(description=chr(10).join(desc_lines), color=color)
            embed.set_author(name=f"Now playing for {user.display_name}" if is_p else f"Last played by {user.display_name}")
            if img: embed.set_thumbnail(url=img)
            
            t_info_task = asyncio.create_task(fetch_track_info(username, artist, song))
            a_info_task = asyncio.create_task(fetch_artist_info(username, artist))
            
            guild = getattr(ctx_int, 'guild', None)
            crown_task = None
            if guild:
                users_db = load_users()
                linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
                if linked:
                    async def fetch_crown():
                        tasks = [(uid, lname, fetch_artist_playcount(bot.session, lname, artist)) for uid, lname in linked.items()]
                        results = await asyncio.gather(*(t[2] for t in tasks))
                        lb = [{"name": guild.get_member(int(tasks[i][0])).display_name if guild.get_member(int(tasks[i][0])) else tasks[i][1], "plays": pc} for i, pc in enumerate(results) if pc > 0]
                        if not lb: return None
                        lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
                        return lb[0]
                    crown_task = asyncio.create_task(fetch_crown())
            
            t_info = await t_info_task
            a_info = await a_info_task
            crown_winner = await crown_task if crown_task else None

            footer_parts = []
            if a_info and 'artist' in a_info and 'tags' in a_info['artist'] and 'tag' in a_info['artist']['tags']:
                tags = [tag['name'].lower() for tag in a_info['artist']['tags']['tag'][:4]]
                if tags: footer_parts.append(" - ".join(tags))
                
            stats_line = []
            if t_info and 'track' in t_info and t_info['track'].get('userloved') == '1':
                stats_line.append("❤️ Loved track")
            
            if a_info and 'artist' in a_info and 'stats' in a_info['artist']:
                pc = a_info['artist']['stats'].get('userplaycount', 0)
                stats_line.append(f"{pc} artist scrobbles")
                
            if crown_winner:
                stats_line.append(f"👑 {crown_winner['name']} ({crown_winner['plays']} plays)")
            
            if stats_line:
                footer_parts.append(" • ".join(stats_line))
                
            embed.set_footer(text=chr(10).join(footer_parts) if footer_parts else f"Scrobbling as {username}")
            return {"embed": embed}, is_p

        desc = chr(10).join([f"**[{song}]({track_url})**", f"by **{artist}**", f"*{album}*"])
        embed = discord.Embed(description=desc, color=color)
        embed.set_author(name=f"{user.display_name}'s {status}", icon_url=user.display_avatar.url)
        if img: embed.set_thumbnail(url=img)
        
        footer_text = f"Scrobbling as {username}"
        if cd > 0: footer_text += f" • Avatar CD: {cd}m"
        embed.set_footer(text=footer_text)
        
        return {"embed": embed}, is_p
    except Exception as e: 
        print(f"{Log.RED}>>> parsing error: {e}{Log.RESET}")
        return None, "Error formatting track."
async def process_top_artists(user, input_period=None):
    username = get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)
    
    d_source = await get_user_data_source(user.id)
    if d_source == 'imported_only':
        username = None


    lastfm_data = {}
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        data = await fetch_top_artists(username, api_p)
        if data and 'topartists' in data:
            lastfm_data = {a['name']: int(a['playcount']) for a in data['topartists']['artist']}

    local_data = await get_local_top_artists(user.id, 50, api_p, before_dt=reg_datetime)

    if not username and not local_data:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_data)
    for artist, count in local_data.items():
        combined[artist] = combined.get(artist, 0) + count

    sorted_artists = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_artists: return None, "No artist data found."

    lines = [f"{get_medal(idx)} **{name}** — **{count:,}** plays" for idx, (name, count) in enumerate(sorted_artists)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    db_note = " *(Last.fm + Imported)*" if local_data else ""
    embed.set_author(name=f"{user.display_name}'s Top Artists ({disp_p}){db_note}", icon_url=user.display_avatar.url)
    return embed, None
async def process_top_tracks(user, input_period=None):
    username = get_lastfm_username(user.id)
    api_p, disp_p = get_period_data(input_period)

    d_source = await get_user_data_source(user.id)
    if d_source == 'imported_only':
        username = None


    lastfm_tracks = {}  # (track, artist) -> plays
    reg_datetime = None
    if username:
        # Fetch user profile to get registration date for deduplication
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.utcfromtimestamp(int(user_info['user']['registered']['unixtime']))
            
        data = await fetch_top_tracks(username, api_p)
        if data and 'toptracks' in data:
            for t in data['toptracks']['track']:
                key = (t['name'], t['artist']['name'])
                lastfm_tracks[key] = int(t['playcount'])

    local_tracks = await get_local_top_tracks(user.id, 50, api_p, before_dt=reg_datetime)

    if not username and not local_tracks:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    combined = dict(lastfm_tracks)
    for track_name, artist_name, plays in local_tracks:
        key = (track_name, artist_name)
        combined[key] = combined.get(key, 0) + plays

    sorted_tracks = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_tracks: return None, "No track data found."

    lines = [f"{get_medal(idx)} **{t}** by {a} — **{c:,}** plays" for idx, ((t, a), c) in enumerate(sorted_tracks)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    db_note = " *(Last.fm + Imported)*" if local_tracks else ""
    embed.set_author(name=f"{user.display_name}'s Top Tracks ({disp_p}){db_note}", icon_url=user.display_avatar.url)
    return embed, None
async def process_recent(user):
    username = get_lastfm_username(user.id)
    if username:
        data = await fetch_now_playing(username, 10)
        if data:
            lines = [f"{'🎶' if i == 0 and t.get('@attr', {}).get('nowplaying') == 'true' else f'` {i+1}. `'} **{t['name']}** by {t['artist']['#text']}" for i, t in enumerate(data['recenttracks']['track'][:10])]
            embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{user.display_name}'s Recent Tracks", icon_url=user.display_avatar.url)
            return embed, None
    # Fallback to local DB
    local = await get_local_recent_tracks(user.id, 10)
    if not local: return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
    lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
    return embed, None
async def process_profile(user):
    username = get_lastfm_username(user.id)
    local_total = await get_local_total_plays(user.id)

    d_source = await get_user_data_source(user.id)
    if d_source == 'imported_only':
        username = None

    if not username and local_total == 0:
        return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."

    embed = discord.Embed(color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Profile", icon_url=user.display_avatar.url)

    if username:
        data = await fetch_user_profile(username)
        if data:
            info = data['user']
            embed.title = f"{info['name']}'s Last.fm Profile"
            embed.url = info['url']
            lastfm_plays = int(info['playcount'])
            
            # Smart De-duplication of duplicate plays:
            # We only count imported database plays that occurred BEFORE their Last.fm registration time.
            # All plays after registration are already scrobbled and counted in lastfm_plays!
            reg_unixtime = int(info['registered']['unixtime'])
            reg_datetime = datetime.utcfromtimestamp(reg_unixtime)
            local_unique = await get_local_plays_before(user.id, reg_datetime)
            
            total = lastfm_plays + local_unique
            embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
            if local_total > 0:
                embed.add_field(name="📦 Imported Plays (Unique)", value=f"**{local_unique:,}**", inline=True)
                embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
            
            if local_total > 0:
                overlap = local_total - local_unique
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles during Last.fm overlap.")
    elif local_total > 0:
        embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
        embed.add_field(name="ℹ️ Last.fm", value="Not linked — use `/setfm`", inline=True)

    return embed, None
async def process_whoknows(guild, user, artist_name):
    if not guild: return None, "Must be used in a server."
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    if not artist_name:
        username = get_lastfm_username(user.id)
        if not username: return None, "Link account or provide an artist name."
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return None, "You aren't playing anything right now!"

    lb = []
    tasks = [(uid, lname, fetch_artist_playcount(bot.session, lname, artist_name)) for uid, lname in linked.items()]
    results = await asyncio.gather(*(t[2] for t in tasks))
    for idx, pc in enumerate(results):
        if pc > 0:
            m = guild.get_member(int(tasks[idx][0]))
            lb.append({"name": m.display_name if m else tasks[idx][1], "plays": pc})

    if not lb: return None, f"No one here listens to **{artist_name}**."
    lb = sorted(lb, key=lambda x: x['plays'], reverse=True)
    lines = [f"{get_medal(i)} **{u['name']}** — **{u['plays']:,}** plays" for i, u in enumerate(lb[:15])]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"Who knows {artist_name} in {guild.name}?", icon_url=guild.icon.url if guild.icon else None)
    
    footer_text = f"Requested by {user.name}"
    if lb[0]['name'] == user.display_name: footer_text = "👑 You hold the crown! • " + footer_text
    embed.set_footer(text=footer_text)
    return embed, None
async def process_suggestion(ctx_int, user, suggestion_text):
    try:
        owner = await bot.fetch_user(OWNER_ID)
        embed = discord.Embed(title="💡 New Bot Suggestion", description=suggestion_text, color=discord.Color.gold(), timestamp=datetime.now())
        embed.set_author(name=f"{user.display_name} ({user.id})", icon_url=user.display_avatar.url)
        guild_name = ctx_int.guild.name if getattr(ctx_int, 'guild', None) else "DMs / User App"
        embed.set_footer(text=f"Sent from: {guild_name}")
        await owner.send(embed=embed, view=SuggestionView())
        print(f"{Log.GREEN}>>> New suggestion forwarded to owner.{Log.RESET}")
        
        confirm = discord.Embed(description="✅ Suggestion sent directly to the developer!", color=discord.Color.green())
        if isinstance(ctx_int, discord.Interaction): await ctx_int.response.send_message(embed=confirm, ephemeral=True)
        else: await ctx_int.send(embed=confirm)
    except Exception as e:
        print(f"{Log.RED}>>> Suggestion error: {e}{Log.RESET}")
async def process_crowns(guild, user):
    if not guild: return None, "Must be used in a server."
    username = get_lastfm_username(user.id)
    if not username: return None, "Link your account first with `/setfm [username]`"
    
    users_db = load_users()
    linked = {uid: lname for uid, lname in users_db.items() if uid in [str(m.id) for m in guild.members]}
    if not linked: return None, "No one in this server has linked their account."
    
    top_artists_data = await fetch_top_artists(username, 'overall', 15)
    if not top_artists_data or 'topartists' not in top_artists_data: return None, "Error fetching your top artists."
    
    artists_to_check = [a['name'] for a in top_artists_data['topartists']['artist']]
    if not artists_to_check: return None, "You don't have any artists in your history!"

    async def check_artist(artist):
        tasks = [(uid, fetch_artist_playcount(bot.session, lname, artist)) for uid, lname in linked.items()]
        results = await asyncio.gather(*(t[1] for t in tasks))
        top_plays = max(results) if results else 0
        if top_plays > 0:
            top_user = tasks[results.index(top_plays)][0]
            if top_user == str(user.id): return (artist, top_plays)
        return None

    artist_results = await asyncio.gather(*(check_artist(artist) for artist in artists_to_check))
    crowns = [r for r in artist_results if r is not None]
    
    if not crowns:
        return None, "You don't hold any crowns for your top 15 artists in this server!"
        
    lines = [f"👑 **{artist}** — **{plays:,}** plays" for artist, plays in crowns]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Crowns in {guild.name}", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Checked your top 15 artists")
    return embed, None