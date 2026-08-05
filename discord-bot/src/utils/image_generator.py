import io
import asyncio
import aiohttp
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import List, Tuple

async def download_image(session: aiohttp.ClientSession, url: str, artist: str = None, album: str = None) -> Image.Image:
    is_missing = not url or '2a96cbd8' in url or '4128a6eb' in url
    if is_missing and artist and album:
        try:
            import urllib.parse
            query = urllib.parse.quote(f"{artist} {album}")
            async with session.get(f"https://itunes.apple.com/search?term={query}&entity=album&limit=1", timeout=5) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    if data.get('results'):
                        url = data['results'][0].get('artworkUrl100', '').replace('100x100bb', '600x600bb')
        except Exception:
            pass

    # If it's still missing or the iTunes search failed, use the default star
    if not url or '2a96cbd8' in url or '4128a6eb' in url:
        url = "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png"
        
    try:
        async with session.get(url, timeout=10) as resp:
            if resp.status == 200:
                data = await resp.read()
                return Image.open(io.BytesIO(data)).convert('RGBA')
    except Exception:
        pass
    return Image.new('RGBA', (300, 300), color=(30, 30, 30, 255))

async def generate_chart(items: List[dict], columns: int, rows: int, show_text: bool = True) -> io.BytesIO:
    """
    items: List of dicts with 'image_url', 'primary_text' (e.g. Album Name), 'secondary_text' (e.g. Artist or Plays)
    """
    cell_size = 300
    width = columns * cell_size
    height = rows * cell_size

    chart = Image.new('RGB', (width, height), color=(20, 20, 20))
    
    async with aiohttp.ClientSession() as session:
        tasks = [download_image(session, item.get('image_url'), item.get('fallback_artist'), item.get('fallback_album')) for item in items]
        images = await asyncio.gather(*tasks)

    try:
        # We try to load a decent font, fallback to default
        font_primary = ImageFont.truetype("arial.ttf", 24)
        font_secondary = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        font_primary = ImageFont.load_default()
        font_secondary = ImageFont.load_default()

    for idx, (img, item) in enumerate(zip(images, items)):
        if idx >= columns * rows:
            break
            
        row = idx // columns
        col = idx % columns
        
        # Resize/Crop to cell size
        img = img.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
        
        # Overlay text if requested
        if show_text:
            # Create a slight dark gradient at the bottom or just a dark overlay box
            overlay = Image.new('RGBA', (cell_size, cell_size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Draw semi-transparent rectangle at bottom for text readability
            draw.rectangle([(0, cell_size - 60), (cell_size, cell_size)], fill=(0, 0, 0, 180))
            
            p_text = item.get('primary_text', '')
            s_text = item.get('secondary_text', '')
            
            # Very basic text wrapping/truncating
            if len(p_text) > 25: p_text = p_text[:22] + "..."
            if len(s_text) > 30: s_text = s_text[:27] + "..."
            
            # Draw text
            draw.text((10, cell_size - 55), p_text, font=font_primary, fill=(255, 255, 255, 255))
            draw.text((10, cell_size - 28), s_text, font=font_secondary, fill=(200, 200, 200, 255))
            
            img = Image.alpha_composite(img, overlay)
            img = img.convert('RGB')
            
        chart.paste(img, (col * cell_size, row * cell_size))

    # Save to BytesIO
    buffer = io.BytesIO()
    chart.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    return buffer
