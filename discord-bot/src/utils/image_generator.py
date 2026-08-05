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

async def _process_cell(session, item, idx, columns, cell_size, chart, font_primary, font_secondary, show_text, semaphore):
    async with semaphore:
        img = await download_image(session, item.get('image_url'), item.get('fallback_artist'), item.get('fallback_album'))
        
        row = idx // columns
        col = idx % columns
        
        # Resize/Crop to cell size in-place
        img.thumbnail((cell_size, cell_size), Image.Resampling.LANCZOS)
        # Ensure it is exactly cell_size x cell_size (in case aspect ratio was off)
        if img.size != (cell_size, cell_size):
            img = img.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
        
        # Overlay text if requested
        if show_text:
            overlay = Image.new('RGBA', (cell_size, cell_size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Draw semi-transparent rectangle at bottom
            draw.rectangle([(0, cell_size - 60), (cell_size, cell_size)], fill=(0, 0, 0, 180))
            
            p_text = item.get('primary_text', '')
            s_text = item.get('secondary_text', '')
            
            if len(p_text) > 25: p_text = p_text[:22] + "..."
            if len(s_text) > 30: s_text = s_text[:27] + "..."
            # Draw text
            draw.text((10, cell_size - 55), p_text, font=font_primary, fill=(255, 255, 255, 255))
            draw.text((10, cell_size - 28), s_text, font=font_secondary, fill=(200, 200, 200, 255))
            
            # In-place alpha composite to save memory
            img.alpha_composite(overlay)
            img = img.convert('RGB')
            
        chart.paste(img, (col * cell_size, row * cell_size))

async def generate_chart(items: List[dict], columns: int, rows: int, show_text: bool = True) -> io.BytesIO:
    """
    items: List of dicts with 'image_url', 'primary_text' (e.g. Album Name), 'secondary_text' (e.g. Artist or Plays)
    """
    cell_size = 300
    width = columns * cell_size
    height = rows * cell_size

    chart = Image.new('RGB', (width, height), color=(20, 20, 20))
    
    try:
        font_primary = ImageFont.truetype("arial.ttf", 24)
        font_secondary = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        font_primary = ImageFont.load_default()
        font_secondary = ImageFont.load_default()

    # Drastically limit concurrent downloads to 3 to prevent OOM on 128/256MB RAM hosts
    semaphore = asyncio.Semaphore(3) 
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for idx, item in enumerate(items):
            if idx >= columns * rows:
                break
            tasks.append(_process_cell(session, item, idx, columns, cell_size, chart, font_primary, font_secondary, show_text, semaphore))
            
        await asyncio.gather(*tasks)

    # Save to BytesIO
    buffer = io.BytesIO()
    chart.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    return buffer
