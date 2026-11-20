import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.utils.statsfm import test_statsfm, statsfm_user_top_tracks, statsfm_user_top_artists, statsfm_get, statsfm_get


async def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "GamerNation12"

    print(f"\n=== Testing stats.fm for user: {username} ===\n")

    success, msg, data = await test_statsfm(username)
    print(f"Profile: {'OK' if success else 'FAIL'} - {msg}")
    if data:
        print(f"Raw profile keys: {list(data.keys())[:10]}")
        print(f"Sample data: {str(data)[:500]}")

    print("\n--- Top tracks ---")
    tracks = await statsfm_user_top_tracks(username, limit=5)
    if tracks:
        for i, t in enumerate(tracks, 1):
            name = t.get("name") or t.get("trackName") or t.get("title") or "Unknown"
            artist = t.get("artist") or t.get("artistName") or t.get("artist", {}).get("name") if isinstance(t.get("artist"), dict) else t.get("artist") or "Unknown"
            plays = t.get("playcount") or t.get("plays") or t.get("count") or "?"
            print(f"  {i}. {name} - {artist} ({plays} plays)")
    else:
        print("  No top tracks data (or endpoint needs different path)")

    print("\n--- Top artists ---")
    artists = await statsfm_user_top_artists(username, limit=5)
    if artists:
        for i, a in enumerate(artists, 1):
            name = a.get("name") or a.get("artistName") or "Unknown"
            plays = a.get("playcount") or a.get("plays") or a.get("count") or "?"
            print(f"  {i}. {name} ({plays} plays)")
    else:
        print("  No top artists data")

    # Also print raw responses for debugging
    print("\n=== Raw responses for debugging ===")
    raw_profile = await statsfm_get(f"users/{username}")
    if raw_profile:
        print(f"Profile raw keys: {list(raw_profile.keys())}")
        item = raw_profile.get("item", {})
        print(f"Profile item keys: {list(item.keys())[:15]}")

    raw_tracks = await statsfm_get(f"users/{username}/top/tracks", {"limit": 3})
    if raw_tracks:
        print(f"Top tracks raw keys: {list(raw_tracks.keys())}")
        print(f"Top tracks raw (first 500 chars): {str(raw_tracks)[:500]}")

    raw_artists = await statsfm_get(f"users/{username}/top/artists", {"limit": 3})
    if raw_artists:
        print(f"Top artists raw keys: {list(raw_artists.keys())}")
        print(f"Top artists raw (first 500 chars): {str(raw_artists)[:500]}")


if __name__ == "__main__":
    asyncio.run(main())
