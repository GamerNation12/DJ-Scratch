import io
import aiohttp
from PIL import Image
from collections import Counter

async def get_album_art_color(image_url: str) -> int:
    """Extract dominant color from album art URL. Returns discord color int."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url) as resp:
                if resp.status != 200:
                    return 0x2b2d31
                data = await resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((100, 100))
        pixels = list(img.getdata())
        # Quantize to find dominant
        quantized = [(r//16*16, g//16*16, b//16*16) for r,g,b in pixels]
        most_common = Counter(quantized).most_common(1)[0][0]
        r, g, b = most_common
        return (r << 16) | (g << 8) | b
    except Exception:
        return 0x2b2d31