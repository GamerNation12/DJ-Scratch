import re

with open('src/commands/settings.py', 'r', encoding='utf-8') as f:
    content = f.read()

# settings.py modification 1
pat_old_1 = '    ds_desc = "📦 Imported Only" if d_source == "imported_only" else "🔄 Last.fm + Imported"'
pat_new_1 = '    ds_desc = "📦 Imported Only" if d_source == "imported_only" else ("🎧 Last.fm Only" if d_source == "lastfm_only" else "🔄 Last.fm + Imported")'
content = content.replace(pat_old_1, pat_new_1)

# settings.py modification 2
pat_old_2 = """            discord.SelectOption(label="Data: Combined", description="Use Last.fm + Imported Data", emoji="🔄", value="ds_combined"),
            discord.SelectOption(label="Data: Imported Only", description="Use strictly your Imported Data", emoji="📦", value="ds_imported_only"),"""
pat_new_2 = """            discord.SelectOption(label="Data: Combined", description="Use Last.fm + Imported Data", emoji="🔄", value="ds_combined"),
            discord.SelectOption(label="Data: Imported Only", description="Use strictly your Imported Data", emoji="📦", value="ds_imported_only"),
            discord.SelectOption(label="Data: Last.fm Only", description="Use strictly your Last.fm Data", emoji="🎧", value="ds_lastfm_only"),"""
content = content.replace(pat_old_2, pat_new_2)

with open('src/commands/settings.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/core/events.py', 'r', encoding='utf-8') as f:
    content = f.read()

# events.py modifications
# 1. source_label
content = content.replace(
    '    source_label = "Imported Only" if d_source == \'imported_only\' else "Last.fm + Imported"',
    '    source_label = "Imported Only" if d_source == \'imported_only\' else ("Last.fm Only" if d_source == \'lastfm_only\' else "Last.fm + Imported")'
)

# 2. process_top_artists
content = content.replace(
    "    local_data = await get_local_top_artists(user.id, 250, api_p, before_dt=None)",
    "    local_data = {}\n    if d_source != 'lastfm_only':\n        local_data = await get_local_top_artists(user.id, 250, api_p, before_dt=None)"
)

# 3. process_top_tracks
content = content.replace(
    "    local_tracks = await get_local_top_tracks(user.id, 250, api_p, before_dt=None)",
    "    local_tracks = []\n    if d_source != 'lastfm_only':\n        local_tracks = await get_local_top_tracks(user.id, 250, api_p, before_dt=None)"
)

# 4. process_artist_tracks
content = content.replace(
    "    local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=None)",
    "    local_tracks = []\n    if d_source != 'lastfm_only':\n        local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=None)"
)

# 5. process_judge
content = content.replace(
    "    local_artists = await get_local_top_artists(user.id, 50, 'overall')",
    "    local_artists = {}\n    if d_source != 'lastfm_only':\n        local_artists = await get_local_top_artists(user.id, 50, 'overall')"
)

# 6. process_recent
pat_recent_old = """    # Fallback to local DB
    local = await get_local_recent_tracks(user.id, 10)
    if not local: return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
    lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]"""

pat_recent_new = """    # Fallback to local DB
    if d_source != 'lastfm_only':
        local = await get_local_recent_tracks(user.id, 10)
        if local:
            lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]
            embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
            embed.set_author(name=f"{user.display_name}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.set_footer(text=f"Requested by {user.display_name} • Using Imported Data", icon_url=user.display_avatar.url)
            return embed, None
    return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
"""

# Note: We need to replace up to the return statement. Let's just use string replacement carefully.
pat_recent_full_old = """    # Fallback to local DB
    local = await get_local_recent_tracks(user.id, 10)
    if not local: return None, "Link Last.fm with `/setfm [username]` or import history on the web portal."
    lines = [f"` {i+1}. ` **{t}** by {a}" for i, (t, a, _) in enumerate(local)]
    embed = discord.Embed(description=chr(10).join(lines), color=LASTFM_COLOR, timestamp=datetime.now())
    embed.set_author(name=f"{user.display_name}'s Recent Tracks *(Imported)*", icon_url=user.display_avatar.url)
    embed.set_thumbnail(url=user.display_avatar.url)
    embed.set_footer(text=f"Requested by {user.display_name} • Using Imported Data", icon_url=user.display_avatar.url)
    return embed, None"""

content = content.replace(pat_recent_full_old, pat_recent_new)

# 7. process_profile
prof_old = """            if d_source == 'imported_only':
                total = local_total
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
            else:
                total = max(lastfm_plays, local_total)
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                if local_total > 0:
                    embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
                    embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)"""

prof_new = """            if d_source == 'imported_only':
                total = local_total
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
            elif d_source == 'lastfm_only':
                total = lastfm_plays
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            else:
                total = max(lastfm_plays, local_total)
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                if local_total > 0:
                    embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
                    embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)"""

content = content.replace(prof_old, prof_new)

with open('src/core/events.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
