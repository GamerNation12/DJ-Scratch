from src.core.theme import Theme
from src.core.events import get_all_valid_users, get_color
from src.core.database import get_server_top_artists, get_server_top_albums, get_server_top_tracks, format_name, get_user_embed_color
from datetime import datetime

async def process_server_artists(guild, user, period='overall'):
    if not guild: return Theme.get_error_embed(description="Must be used in a server."), None
    linked = await get_all_valid_users(guild)
    if not linked: return Theme.get_error_embed(description="No one in this server has linked their account or imported data."), None
    
    member_ids = list(linked.keys())
    lb = await get_server_top_artists(member_ids, limit=15, api_period=period)
    
    if not lb: return Theme.get_error_embed(description="No data available for this server in the given period."), None
    
    lines = [f"` {i+1}. ` **{artist}** — **{plays:,}** plays" for i, (artist, plays) in enumerate(lb)]
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
    embed.set_author(name=f"Top Artists in {guild.name}", icon_url=guild.icon.url if guild.icon else None)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None

async def process_server_albums(guild, user, period='overall'):
    if not guild: return Theme.get_error_embed(description="Must be used in a server."), None
    linked = await get_all_valid_users(guild)
    if not linked: return Theme.get_error_embed(description="No one in this server has linked their account or imported data."), None
    
    member_ids = list(linked.keys())
    lb = await get_server_top_albums(member_ids, limit=15, api_period=period)
    
    if not lb: return Theme.get_error_embed(description="No data available for this server in the given period."), None
    
    lines = [f"` {i+1}. ` **{album}** by **{artist}** — **{plays:,}** plays" for i, (album, artist, plays) in enumerate(lb)]
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
    embed.set_author(name=f"Top Albums in {guild.name}", icon_url=guild.icon.url if guild.icon else None)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None

async def process_server_tracks(guild, user, period='overall'):
    if not guild: return Theme.get_error_embed(description="Must be used in a server."), None
    linked = await get_all_valid_users(guild)
    if not linked: return Theme.get_error_embed(description="No one in this server has linked their account or imported data."), None
    
    member_ids = list(linked.keys())
    lb = await get_server_top_tracks(member_ids, limit=15, api_period=period)
    
    if not lb: return Theme.get_error_embed(description="No data available for this server in the given period."), None
    
    lines = [f"` {i+1}. ` **{track}** by **{artist}** — **{plays:,}** plays" for i, (track, artist, plays) in enumerate(lb)]
    color = await get_color(user.id)
    embed = Theme.get_embed(description="\n".join(lines), color=color)
    embed.set_author(name=f"Top Tracks in {guild.name}", icon_url=guild.icon.url if guild.icon else None)
    embed.set_footer(text=f"Requested by {format_name(user)}")
    return embed, None
