import re

with open('src/core/events.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. process_artist_tracks part 1
pat_old_1 = """    lastfm_tracks = {}
    reg_datetime = None
    if username and d_source != 'imported_only':
        user_info = await fetch_user_profile(username)
        if user_info and 'user' in user_info:
            reg_datetime = datetime.fromtimestamp(int(user_info['user']['registered']['unixtime']), tz=timezone.utc)
            
        tracks = await fetch_user_artist_tracks_lastfm(username, artist_name)
        for t_name, playcount in tracks:
            lastfm_tracks[t_name] = playcount

    local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=reg_datetime)"""

pat_new_1 = """    lastfm_tracks = {}
    if username and d_source != 'imported_only':
        tracks = await fetch_user_artist_tracks_lastfm(username, artist_name)
        for t_name, playcount in tracks:
            lastfm_tracks[t_name] = playcount

    local_tracks = await get_local_artist_top_tracks(user.id, artist_name, 5000, 'overall', before_dt=None)"""

content = content.replace(pat_old_1, pat_new_1)

# 2. process_artist_tracks part 2
pat_old_2 = """    combined = dict(lastfm_tracks)
    for track_name, plays in local_tracks:
        combined[track_name] = combined.get(track_name, 0) + plays"""

pat_new_2 = """    combined = dict(lastfm_tracks)
    for track_name, plays in local_tracks:
        combined[track_name] = max(combined.get(track_name, 0), plays)"""

content = content.replace(pat_old_2, pat_new_2)

# 3. process_artist_tracks part 3
pat_old_3 = """    if username and d_source != 'imported_only':
        bot_instance = bot
        session = getattr(bot_instance, 'session', None)
        api_plays = await fetch_artist_playcount(session, username, artist_name)
        if api_plays > total_plays: total_plays = api_plays
        elif local_tracks:
            # Add imported data from before registration
            local_artist_plays = sum(p for _, p in local_tracks)
            total_plays = api_plays + local_artist_plays"""

pat_new_3 = """    if username and d_source != 'imported_only':
        bot_instance = bot
        session = getattr(bot_instance, 'session', None)
        api_plays = await fetch_artist_playcount(session, username, artist_name)
        local_artist_plays = sum(p for _, p in local_tracks)
        total_plays = max(api_plays, local_artist_plays)"""

content = content.replace(pat_old_3, pat_new_3)


# 4. process_profile
prof_old = """            if d_source == 'imported_only':
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

prof_new = """            if d_source == 'imported_only':
                total = local_total
                embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
            else:
                total = max(lastfm_plays, local_total)
                embed.add_field(name="🎧 Last.fm Scrobbles", value=f"**{lastfm_plays:,}**", inline=True)
                if local_total > 0:
                    embed.add_field(name="📦 Imported Plays", value=f"**{local_total:,}**", inline=True)
                    embed.add_field(name="🎵 Total Plays", value=f"**{total:,}**", inline=True)
            
            country = info.get('country', 'Not Set')
            embed.add_field(name="🌍 Country", value=country if country and country != "None" else "Not set", inline=True)
            if info['image'][3]['#text']: embed.set_thumbnail(url=info['image'][3]['#text'])
            
            if local_total > 0 and d_source != 'imported_only':
                overlap = (lastfm_plays + local_total) - total
                embed.set_footer(text=f"Filtered {overlap:,} duplicate scrobbles using MAX deduplication.")"""

content = content.replace(prof_old, prof_new)

with open('src/core/events.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
