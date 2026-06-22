import re

with open('src/core/events.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. process_top_artists
content = content.replace(
    "    if username:\n        # Fetch user profile to get registration date for deduplication",
    "    if username and d_source != 'imported_only':\n        # Fetch user profile to get registration date for deduplication"
)
content = content.replace(
    "    view = TopItemsPaginator(user, sorted_artists, disp_p, username, 'ta')",
    "    view = TopItemsPaginator(user, sorted_artists, disp_p, username if d_source != 'imported_only' else None, 'ta')"
)

# 2. process_top_tracks
content = content.replace(
    "    if username:\n        # Fetch user profile to get registration date for deduplication",
    "    if username and d_source != 'imported_only':\n        # Fetch user profile to get registration date for deduplication"
)
content = content.replace(
    "    view = TopItemsPaginator(user, sorted_tracks, disp_p, username, 'tt')",
    "    view = TopItemsPaginator(user, sorted_tracks, disp_p, username if d_source != 'imported_only' else None, 'tt')"
)

# 3. process_artist_tracks
content = content.replace(
    "    if not artist_name:\n        if not username: return None, None, \"Link account or provide an artist name.\"",
    "    if not artist_name:\n        if not username or d_source == 'imported_only': return None, None, \"Link account or provide an artist name.\""
)
content = content.replace(
    "    if username:\n        user_info = await fetch_user_profile(username)",
    "    if username and d_source != 'imported_only':\n        user_info = await fetch_user_profile(username)"
)

# 4. process_recent
content = content.replace(
    "    username = await get_lastfm_username(user.id)\n    if username:\n        data = await fetch_now_playing(username, 10)",
    "    username = await get_lastfm_username(user.id)\n    d_source = await get_user_data_source(user.id)\n    if username and d_source != 'imported_only':\n        data = await fetch_now_playing(username, 10)"
)

# 5. process_judge
content = content.replace(
    "    # 1. Gather Top 14 Artists\n    artists_dict = {}\n    if username:\n        data = await fetch_top_artists(username, 'overall', 50)",
    "    d_source = await get_user_data_source(user.id)\n    # 1. Gather Top 14 Artists\n    artists_dict = {}\n    if username and d_source != 'imported_only':\n        data = await fetch_top_artists(username, 'overall', 50)"
)

# 6. process_profile
profile_old = """            # Smart De-duplication of duplicate plays:
            # We only count imported database plays that occurred BEFORE their Last.fm registration time.
            # All plays after registration are already scrobbled and counted in lastfm_plays!
            reg_unixtime = int(info['registered']['unixtime'])
            reg_datetime = datetime.fromtimestamp(reg_unixtime, tz=timezone.utc)
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
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles during Last.fm overlap.")"""

profile_new = """            # Smart De-duplication of duplicate plays:
            if d_source == 'imported_only':
                total = local_total
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
            else:
                # We only count imported database plays that occurred BEFORE their Last.fm registration time.
                # All plays after registration are already scrobbled and counted in lastfm_plays!
                reg_unixtime = int(info['registered']['unixtime'])
                reg_datetime = datetime.fromtimestamp(reg_unixtime, tz=timezone.utc)
                local_unique = await get_local_plays_before(user.id, reg_datetime)
                
                total = lastfm_plays + local_unique
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                if local_total > 0:
                    embed.add_field(name="📦 Imported Plays (Unique)", value=f"**{local_unique:,}**", inline=True)
                    embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
            
            if local_total > 0 and d_source != 'imported_only':
                overlap = local_total - local_unique
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles during Last.fm overlap.")"""

content = content.replace(profile_old, profile_new)

with open('src/core/events.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
