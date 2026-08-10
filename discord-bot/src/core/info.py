import discord
from src.core.theme import Theme
from src.core.database import db_fetch, db_fetchval, format_name
from src.core.events import get_lastfm_username, fetch_now_playing
from src.utils.api import fetch_artist_info, fetch_album_info, fetch_track_info

async def get_current_playing_fallback(user, type_needed="artist"):
    username = await get_lastfm_username(user.id)
    if not username: return None, None, None
    np = await fetch_now_playing(username, 1)
    if np and 'recenttracks' in np and np['recenttracks']['track']:
        t = np['recenttracks']['track'][0]
        artist = t['artist']['#text'] if isinstance(t.get('artist'), dict) else t.get('artist')
        track = t.get('name')
        album = t.get('album', {}).get('#text') if isinstance(t.get('album'), dict) else t.get('album')
        if type_needed == "artist": return artist, None, None
        if type_needed == "album": return artist, album, None
        if type_needed == "track": return artist, None, track
    return None, None, None

async def process_artist_info(user, artist_name=None):
    if not artist_name:
        artist_name, _, _ = await get_current_playing_fallback(user, "artist")
        if not artist_name:
            return Theme.get_error_embed(description="You must provide an artist name or be currently scrobbling one."), None
    
    username = await get_lastfm_username(user.id)
    api_data = await fetch_artist_info(username or "dj-scratch", artist_name)
    
    if not api_data or 'error' in api_data or 'artist' not in api_data:
        return Theme.get_error_embed(description=f"Artist **{artist_name}** not found on Last.fm."), None
        
    a = api_data['artist']
    actual_name = a.get('name', artist_name)
    global_listeners = int(a['stats'].get('listeners', 0))
    global_plays = int(a['stats'].get('playcount', 0))
    user_plays = int(a['stats'].get('userplaycount', 0))
    
    url = a.get('url', f"https://www.last.fm/music/{actual_name.replace(' ', '+')}")
    
    tags = [t['name'] for t in a.get('tags', {}).get('tag', [])] if isinstance(a.get('tags', {}).get('tag'), list) else []
    
    embed = Theme.get_embed(title=actual_name, url=url, color=Theme.PRIMARY)
    embed.set_author(name=f"Artist Info for {format_name(user)}", icon_url=user.display_avatar.url)
    
    desc = f"**Your Plays:** `{user_plays:,}`\n"
    desc += f"**Global Listeners:** `{global_listeners:,}`\n"
    desc += f"**Global Scrobbles:** `{global_plays:,}`\n"
    
    if tags: desc += f"\n**Tags:** {', '.join(tags[:5])}"
    
    embed.description = desc
    
    return embed, None

async def process_album_info(user, args=None):
    artist_name = None
    album_name = None
    
    if not args:
        artist_name, album_name, _ = await get_current_playing_fallback(user, "album")
    elif "-" in args:
        parts = args.split("-", 1)
        artist_name, album_name = parts[0].strip(), parts[1].strip()
    else:
        artist_name, album_name, _ = await get_current_playing_fallback(user, "album")
        if not album_name: album_name = args.strip() # fallback if playing nothing? actually if no '-', assume album name and playing artist
    
    if not artist_name or not album_name:
        return Theme.get_error_embed(description="Please provide `Artist - Album` or be playing an album."), None

    username = await get_lastfm_username(user.id)
    api_data = await fetch_album_info(username or "dj-scratch", artist_name, album_name)
    
    if not api_data or 'error' in api_data or 'album' not in api_data:
        return Theme.get_error_embed(description=f"Album not found: **{artist_name} - {album_name}**"), None
        
    a = api_data['album']
    actual_album = a.get('name', album_name)
    actual_artist = a.get('artist', artist_name)
    global_listeners = int(a.get('listeners', 0))
    global_plays = int(a.get('playcount', 0))
    user_plays = int(a.get('userplaycount', 0))
    
    url = a.get('url', "")
    image = ""
    if a.get('image'): image = a['image'][-1].get('#text', "")
    
    tags = [t['name'] for t in a.get('tags', {}).get('tag', [])] if isinstance(a.get('tags', {}).get('tag'), list) else []
    
    embed = Theme.get_embed(title=f"{actual_artist} - {actual_album}", url=url, color=Theme.PRIMARY)
    embed.set_author(name=f"Album Info for {format_name(user)}", icon_url=user.display_avatar.url)
    
    desc = f"**Your Plays:** `{user_plays:,}`\n"
    desc += f"**Global Listeners:** `{global_listeners:,}`\n"
    desc += f"**Global Scrobbles:** `{global_plays:,}`\n"
    if tags: desc += f"\n**Tags:** {', '.join(tags[:5])}"
    
    embed.description = desc
    if image: embed.set_thumbnail(url=image)
    return embed, None

async def process_track_info(user, args=None):
    artist_name = None
    track_name = None
    
    if not args:
        artist_name, _, track_name = await get_current_playing_fallback(user, "track")
    elif "-" in args:
        parts = args.split("-", 1)
        artist_name, track_name = parts[0].strip(), parts[1].strip()
    else:
        artist_name, _, track_name = await get_current_playing_fallback(user, "track")
        if not track_name: track_name = args.strip()
    
    if not artist_name or not track_name:
        return Theme.get_error_embed(description="Please provide `Artist - Track` or be playing a track."), None

    username = await get_lastfm_username(user.id)
    api_data = await fetch_track_info(username or "dj-scratch", artist_name, track_name)
    
    if not api_data or 'error' in api_data or 'track' not in api_data:
        return Theme.get_error_embed(description=f"Track not found: **{artist_name} - {track_name}**"), None
        
    a = api_data['track']
    actual_track = a.get('name', track_name)
    actual_artist = a['artist'].get('name', artist_name) if isinstance(a.get('artist'), dict) else a.get('artist', artist_name)
    global_listeners = int(a.get('listeners', 0))
    global_plays = int(a.get('playcount', 0))
    user_plays = int(a.get('userplaycount', 0))
    
    url = a.get('url', "")
    album = a.get('album', {}).get('title', "")
    
    tags = [t['name'] for t in a.get('toptags', {}).get('tag', [])] if isinstance(a.get('toptags', {}).get('tag'), list) else []
    
    embed = Theme.get_embed(title=f"{actual_artist} - {actual_track}", url=url, color=Theme.PRIMARY)
    embed.set_author(name=f"Track Info for {format_name(user)}", icon_url=user.display_avatar.url)
    
    desc = f"**Your Plays:** `{user_plays:,}`\n"
    if album: desc += f"**Album:** {album}\n"
    desc += f"**Global Listeners:** `{global_listeners:,}`\n"
    desc += f"**Global Scrobbles:** `{global_plays:,}`\n"
    if tags: desc += f"\n**Tags:** {', '.join(tags[:5])}"
    
    embed.description = desc
    
    # Try to grab album image
    if 'album' in a and 'image' in a['album']:
        embed.set_thumbnail(url=a['album']['image'][-1]['#text'])
        
    return embed, None
