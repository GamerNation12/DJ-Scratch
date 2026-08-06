from src.core.theme import Theme
from src.core.database import get_global_whoknows, get_global_whoknows_track, get_global_whoknows_album, format_name, get_user_embed_color
from src.core.events import get_lastfm_username, fetch_now_playing, get_color
from datetime import datetime

async def process_global_whoknows(user, artist_name, bot):
    if not artist_name:
        username = await get_lastfm_username(user.id)
        if not username: return Theme.get_error_embed(description="Link account or provide an artist name."), None
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return Theme.get_error_embed(description="You aren't playing anything right now!"), None
        
    lb = await get_global_whoknows(artist_name)
    if not lb: return Theme.get_error_embed(description=f"No one globally listens to **{artist_name}**."), None
    
    lines = []
    for i, (uid, plays) in enumerate(lb):
        target_user = bot.get_user(int(uid))
        if not target_user: 
            try: target_user = await bot.fetch_user(int(uid))
            except: pass
        name = format_name(target_user) if target_user else f"User {uid}"
        lines.append(f"` {i+1}. ` **{name}** — **{plays:,}** plays")
        
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color, timestamp=datetime.now())
    embed.set_author(name=f"Global Who Knows {artist_name}?", icon_url=user.display_avatar.url)
    
    footer_text = f"Requested by {format_name(user)}"
    if lb[0][0] == str(user.id): footer_text = "👑 You hold the global crown! • " + footer_text
    embed.set_footer(text=footer_text)
    return embed, None

async def process_global_whoknowstrack(user, query, bot):
    artist_name, track_name = None, None
    if query and "|" in query:
        parts = query.split("|")
        artist_name, track_name = parts[0].strip(), parts[1].strip()
    else:
        username = await get_lastfm_username(user.id)
        if not username: return Theme.get_error_embed(description="Link account or provide an artist|track name."), None
        np_data = await fetch_now_playing(username, 1)
        try:
            artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
            track_name = np_data['recenttracks']['track'][0]['name']
        except: return Theme.get_error_embed(description="You aren't playing anything right now!"), None

    if not artist_name or not track_name:
        return Theme.get_error_embed(description="Please provide an artist and track separated by `|` (e.g. `Drake | One Dance`)"), None
        
    lb = await get_global_whoknows_track(artist_name, track_name)
    if not lb: return Theme.get_error_embed(description=f"No one globally listens to **{track_name}** by **{artist_name}**."), None
    
    lines = []
    for i, (uid, plays) in enumerate(lb):
        target_user = bot.get_user(int(uid))
        if not target_user: 
            try: target_user = await bot.fetch_user(int(uid))
            except: pass
        name = format_name(target_user) if target_user else f"User {uid}"
        lines.append(f"` {i+1}. ` **{name}** — **{plays:,}** plays")
        
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color, timestamp=datetime.now())
    embed.set_author(name=f"Global Who Knows {track_name} by {artist_name}?", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None

async def process_global_whoknowsalbum(user, query, bot):
    artist_name, album_name = None, None
    if query and "|" in query:
        parts = query.split("|")
        artist_name, album_name = parts[0].strip(), parts[1].strip()
    else:
        username = await get_lastfm_username(user.id)
        if not username: return Theme.get_error_embed(description="Link account or provide an artist|album name."), None
        np_data = await fetch_now_playing(username, 1)
        try:
            artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
            album_name = np_data['recenttracks']['track'][0]['album']['#text']
        except: return Theme.get_error_embed(description="You aren't playing anything right now!"), None
        
    if not artist_name or not album_name:
        return Theme.get_error_embed(description="Please provide an artist and album separated by `|` (e.g. `Drake | Views`)"), None
        
    lb = await get_global_whoknows_album(artist_name, album_name)
    if not lb: return Theme.get_error_embed(description=f"No one globally listens to **{album_name}** by **{artist_name}**."), None
    
    lines = []
    for i, (uid, plays) in enumerate(lb):
        target_user = bot.get_user(int(uid))
        if not target_user: 
            try: target_user = await bot.fetch_user(int(uid))
            except: pass
        name = format_name(target_user) if target_user else f"User {uid}"
        lines.append(f"` {i+1}. ` **{name}** — **{plays:,}** plays")
        
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color, timestamp=datetime.now())
    embed.set_author(name=f"Global Who Knows {album_name} by {artist_name}?", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None
