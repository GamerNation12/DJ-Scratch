import discord
import json
import ijson
import zipfile
import io
import uuid
from datetime import datetime
from ..core.database import *
def stream_parse_spotify_json(file_obj):
    buffer = ""
    brace_count = 0
    in_string = False
    escape = False

    while True:
        chunk = file_obj.read(65536)  # Read in small 64KB chunks to consume minimal RAM
        if not chunk:
            break
        
        for char in chunk:
            buffer += char
            
            if escape:
                escape = False
                continue
            
            if char == '\\':
                escape = True
                continue
                
            if char == '"':
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    if brace_count == 0:
                        buffer = "{"
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        try:
                            track = json.loads(buffer)
                            yield track
                        except:
                            pass
                        buffer = ""
def parse_single_spotify_track(user, track):
    artist = track.get("master_metadata_album_artist_name")
    title = track.get("master_metadata_track_name")
    album = track.get("master_metadata_album_album_name") or ""
    played_at_raw = track.get("ts")
    ms_played = track.get("ms_played") or 0

    if not artist or not title or not played_at_raw or ms_played < 30000:
        return None

    try:
        cleaned_time = played_at_raw.replace("Z", "+00:00")
        if " " in cleaned_time and "T" not in cleaned_time:
            parts = cleaned_time.split(":")
            if len(parts) == 2:
                cleaned_time = cleaned_time + ":00"
        try:
            dt = datetime.fromisoformat(cleaned_time)
        except:
            try:
                dt = datetime.strptime(cleaned_time, "%Y-%m-%d %H:%M:%S")
            except:
                dt = datetime.strptime(cleaned_time, "%Y-%m-%d %H:%M")
        return (str(user.id), artist, title, album, dt)
    except:
        return None
async def insert_tracks_in_db(valid_tracks):
    if not valid_tracks:
        return 0
    chunk_size = 1000
    inserted_count = 0
    for i in range(0, len(valid_tracks), chunk_size):
        chunk = valid_tracks[i:i + chunk_size]
        try:
            async with db_pool.acquire() as conn:
                await conn.executemany(
                    """
                    INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
                    """,
                    chunk
                )
                inserted_count += len(chunk)
                print(f"{Log.CYAN}    >>> [IMPORT PROGRESS] Inserted chunk... ({inserted_count} tracks so far in this batch){Log.RESET}")
        except Exception as e:
            print(f"Error inserting database chunk: {e}")
    return inserted_count
async def process_discord_import_in_background(user, temp_filepath, is_zip, response_target):
    import zipfile
    import os
    import gc
    import io

    processed_count = 0
    try:
        # Ensure user exists in imported_users table
        try:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO imported_users (id, username)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
                    """,
                    str(user.id), user.name
                )
        except Exception as e:
            print(f"Error ensuring imported_user: {e}")

        # Parse and process
        if not is_zip:
            # Process single JSON file from disk using our zero-RAM streaming parser
            valid_tracks = []
            with open(temp_filepath, "r", encoding="utf-8", errors="ignore") as f:
                for track in stream_parse_spotify_json(f):
                    parsed = parse_single_spotify_track(user, track)
                    if parsed:
                        valid_tracks.append(parsed)
                    
                    if len(valid_tracks) >= 1000:
                        processed_count += await insert_tracks_in_db(valid_tracks)
                        valid_tracks.clear()
                        gc.collect()
            
            if valid_tracks:
                processed_count += await insert_tracks_in_db(valid_tracks)
                valid_tracks.clear()
                gc.collect()
        else:
            # Process ZIP file entry by entry from disk using our zero-RAM streaming parser
            with zipfile.ZipFile(temp_filepath) as z:
                # fmbot logic: Reject Account Data packages which contain Userdata and lack album names
                if any("userdata" in name.lower() for name in z.namelist()):
                    try:
                        os.remove(temp_filepath)
                    except: pass
                    
                    embed = discord.Embed(
                        title="❌ Invalid Export Package",
                        description="You uploaded the **Account Data** package, which is missing album names and contains duplicates.\\n\\nPlease go to Spotify Privacy settings and request the **Extended streaming history** instead.",
                        color=discord.Color.red(),
                        timestamp=datetime.now()
                    )
                    await user.send(embed=embed)
                    return

                for filename in z.namelist():
                    if filename.endswith(".json") and any(x in filename for x in ["StreamingHistory", "endsong", "Streaming_History"]):
                        try:
                            valid_tracks = []
                            with z.open(filename) as f:
                                # Wrap binary stream in a TextIOWrapper so we can stream characters
                                text_stream = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
                                for track in stream_parse_spotify_json(text_stream):
                                    parsed = parse_single_spotify_track(user, track)
                                    if parsed:
                                        valid_tracks.append(parsed)
                                    
                                    if len(valid_tracks) >= 1000:
                                        processed_count += await insert_tracks_in_db(valid_tracks)
                                        valid_tracks.clear()
                                        gc.collect()
                            
                            if valid_tracks:
                                processed_count += await insert_tracks_in_db(valid_tracks)
                                valid_tracks.clear()
                                gc.collect()
                                
                        except Exception as e:
                            print(f"Error processing {filename} inside zip: {e}")

        # Delete temp file
        try:
            os.remove(temp_filepath)
        except: pass

        # Send DM when finished
        embed = discord.Embed(
            title="✅ Spotify Import Complete!",
            description=(
                f"Hey **{user.display_name}**, your Spotify history has finished importing!\n\n"
                f"• **{processed_count:,}** tracks processed successfully.\n\n"
                f"You can now use bot commands like `/profile` or `/topartists`!"
            ),
            color=0x2ecc71,
            timestamp=datetime.now()
        )
        await user.send(embed=embed)

    except Exception as e:
        print(f"Error in background import process: {e}")
        try:
            os.remove(temp_filepath)
        except: pass
        try:
            await user.send(f"❌ An error occurred during the background import of your Spotify data: {e}")
        except: pass
async def handle_discord_import(user, attachment, response_target):
    try:
        is_zip = attachment.filename.endswith(".zip")
        temp_filepath = f"temp_import_{user.id}_{attachment.id}.{'zip' if is_zip else 'json'}"
        
        # Save attachment directly to disk in streamed mode
        await attachment.save(temp_filepath)
        
        # Add to import queue instead of processing immediately
        await import_queue.put((user, temp_filepath, is_zip, response_target))
        queue_pos = import_queue.qsize()
        
        await response_target(f"✅ File received successfully! You are currently position **#{queue_pos}** in the import queue. The bot will process your history in the background and DM you when finished.")
    except Exception as e:
        print(f"Error in handle_discord_import saving file: {e}")
        await response_target("❌ An error occurred while receiving your file.")
async def handle_discord_import_link(user, link, response_target):
    try:
        is_zip = link.lower().endswith(".zip") or "zip" in link.lower()
        temp_filepath = f"temp_import_{user.id}_link.{'zip' if is_zip else 'json'}"
        
        await response_target("⏳ Downloading file from link... (This may take a moment for large files)")
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(link) as resp:
                if resp.status != 200:
                    await response_target("❌ Failed to download from the provided link. Please ensure it is a direct download link.")
                    return
                with open(temp_filepath, 'wb') as f:
                    while True:
                        chunk = await resp.content.read(65536)
                        if not chunk: break
                        f.write(chunk)
        
        await import_queue.put((user, temp_filepath, is_zip, response_target))
        queue_pos = import_queue.qsize()
        
        await response_target(f"✅ Link downloaded successfully! You are currently position **#{queue_pos}** in the import queue. The bot will DM you when finished.")
        
    except Exception as e:
        print(f"Error in handle_discord_import_link: {e}")
        await response_target("❌ An error occurred while downloading or processing the link.")