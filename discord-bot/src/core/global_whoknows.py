import asyncio
from datetime import datetime
from src.core.theme import Theme
from src.core.database import get_global_whoknows, get_global_whoknows_track, get_global_whoknows_album, format_name, get_user_embed_color, get_user_private_mode
from src.core.events import get_lastfm_username, fetch_now_playing, get_color, get_combined_playcount

async def enhance_global_leaderboard(bot, lb, command_author, artist_name, track_name=None, album_name=None):
    # Ensure command author is in the list
    uid_dict = {str(uid): plays for uid, plays in lb}
    author_id_str = str(command_author.id)
    if author_id_str not in uid_dict:
        uid_dict[author_id_str] = 0
        
    session = getattr(bot, 'session', None)
    
    # Fetch lnames
    uids = list(uid_dict.keys())
    tasks_lnames = [get_lastfm_username(int(uid)) for uid in uids]
    lnames = await asyncio.gather(*tasks_lnames)
    
    # Fetch live playcounts
    tasks_plays = []
    for idx, uid in enumerate(uids):
        lname = lnames[idx]
        if not lname:
            # Create a quick coroutine that returns the DB plays
            async def return_db(v): return v
            tasks_plays.append(return_db(uid_dict[uid]))
        else:
            tasks_plays.append(get_combined_playcount(session, int(uid), lname, artist_name, track=track_name, album=album_name))
            
    live_plays = await asyncio.gather(*tasks_plays)
    
    # Rebuild and sort list
    new_lb = []
    for idx, uid in enumerate(uids):
        plays = max(uid_dict[uid], live_plays[idx])
        if plays > 0:
            new_lb.append({'uid': uid, 'plays': plays})
            
    new_lb.sort(key=lambda x: x['plays'], reverse=True)
    
    # Take top 15 and fetch privacy
    final_lb = new_lb[:15]
    tasks_privacy = [get_user_private_mode(int(item['uid'])) for item in final_lb]
    privacies = await asyncio.gather(*tasks_privacy)
    
    lines = []
    for idx, item in enumerate(final_lb):
        uid = item['uid']
        plays = item['plays']
        is_private = privacies[idx]
        
        if is_private and uid != author_id_str:
            name = "Private user"
        else:
            target_user = bot.get_user(int(uid))
            if not target_user: 
                try: target_user = await bot.fetch_user(int(uid))
                except: pass
            name = format_name(target_user) if target_user else f"User {uid}"
            
        lines.append(f"` {idx+1}. ` **{name}** — **{plays:,}** plays")
        
    return lines, final_lb

async def process_global_whoknows(user, artist_name, bot):
    if not artist_name:
        username = await get_lastfm_username(user.id)
        if not username: return Theme.get_error_embed(description="Link account or provide an artist name."), None
        np_data = await fetch_now_playing(username, 1)
        try: artist_name = np_data['recenttracks']['track'][0]['artist']['#text']
        except: return Theme.get_error_embed(description="You aren't playing anything right now!"), None
        
    lb = await get_global_whoknows(artist_name)
    if not lb: return Theme.get_error_embed(description=f"No one globally listens to **{artist_name}**."), None
    
    lines, final_lb = await enhance_global_leaderboard(bot, lb, user, artist_name)
    
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
    embed.set_author(name=f"Global Who Knows {artist_name}?", icon_url=user.display_avatar.url)
    
    footer_text = f"Requested by {format_name(user)}"
    if final_lb and final_lb[0]['uid'] == str(user.id): footer_text = "👑 You hold the global crown! • " + footer_text
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
    
    lines, final_lb = await enhance_global_leaderboard(bot, lb, user, artist_name, track_name=track_name)
        
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
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
    
    lines, final_lb = await enhance_global_leaderboard(bot, lb, user, artist_name, album_name=album_name)
        
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
    embed.set_author(name=f"Global Who Knows {album_name} by {artist_name}?", icon_url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None
