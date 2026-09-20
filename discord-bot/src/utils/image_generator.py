import io
import asyncio
import aiohttp
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import List, Tuple


def _load_font(name: str, size: int):
    """Best-effort TTF lookup (containers often lack Arial)."""
    for candidate in (name, "DejaVuSans.ttf", "arial.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def _load_font_bold(size: int):
    for candidate in ("DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except (IOError, OSError):
            continue
    return _load_font("", size)


def _fit_text(draw: ImageDraw.ImageDraw, text: str, font, max_px: int) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    try:
        if draw.textlength(text, font=font) <= max_px:
            return text
    except Exception:
        return text[:40]
    while len(text) > 4:
        text = text[:-1].rstrip()
        try:
            if draw.textlength(text + "…", font=font) <= max_px:
                return text + "…"
        except Exception:
            return text
    return text


async def generate_music_card(
    session: aiohttp.ClientSession,
    *,
    display_name: str,
    lastfm_username: str = "",
    badge_names: List[str] | None = None,
    track_title: str = "",
    track_artist: str = "",
    track_album: str = "",
    art_url: str = "",
    is_playing: bool = False,
    top_artist: str = "",
    top_artist_plays: int = 0,
    total_plays: int = 0,
    invite_url: str = "",
) -> io.BytesIO:
    """Shareable stats music card (900x480 JPEG).

    Purely visual — the clickable invite link travels in the message content
    alongside the image, since images can't carry links.
    """
    W, H = 900, 480
    BG = (16, 16, 22)
    ACCENT = (10, 181, 205)
    WHITE = (245, 245, 245)
    GRAY = (170, 170, 180)
    DIM = (120, 120, 130)
    GOLD = (241, 196, 15)

    def _render() -> Image.Image:
        card = Image.new("RGB", (W, H), color=BG)
        draw = ImageDraw.Draw(card)
        draw.rectangle([(0, 0), (12, H)], fill=ACCENT)
        return card, draw

    card, draw = await asyncio.to_thread(_render)

    # Fonts (loaded in-thread with everything else below).
    def _fonts():
        return {
            "name": _load_font_bold(44),
            "handle": _load_font("", 24),
            "badges": _load_font("", 20),
            "label": _load_font_bold(20),
            "title": _load_font_bold(30),
            "artist": _load_font("", 26),
            "album": _load_font("", 22),
            "stats": _load_font("", 24),
            "invite": _load_font("", 20),
            "footer": _load_font("", 18),
        }

    fonts = await asyncio.to_thread(_fonts)

    # Album art (left).
    try:
        art = await download_image(session, art_url)
        art = art.convert("RGB").resize((280, 280), Image.Resampling.LANCZOS)
    except Exception:
        art = Image.new("RGB", (280, 280), color=(30, 30, 36))

    def _compose(base: Image.Image):
        base.paste(art, (44, 150))
        d = ImageDraw.Draw(base)
        x = 350
        right = W - 36
        max_px = right - x
        # Header: display name + Last.fm handle + badges (text only — bitmap
        # fallback fonts can't draw emoji, so badge NAMES, not icons).
        d.text((x, 30), _fit_text(d, display_name or "Unknown", fonts["name"], max_px), font=fonts["name"], fill=WHITE)
        if lastfm_username:
            d.text((x, 84), _fit_text(d, f"@{lastfm_username}", fonts["handle"], max_px), font=fonts["handle"], fill=GRAY)
        if badge_names:
            d.text((x, 114), _fit_text(d, "  •  ".join(badge_names), fonts["badges"], max_px), font=fonts["badges"], fill=GOLD)
        # Current track.
        y = 152 if badge_names else 140
        label = "NOW PLAYING" if is_playing else "LAST PLAYED"
        d.text((x, y), label, font=fonts["label"], fill=ACCENT if is_playing else DIM)
        d.text((x, y + 28), _fit_text(d, track_title or "Unknown track", fonts["title"], max_px), font=fonts["title"], fill=WHITE)
        d.text((x, y + 66), _fit_text(d, track_artist or "Unknown artist", fonts["artist"], max_px), font=fonts["artist"], fill=GRAY)
        if track_album:
            d.text((x, y + 100), _fit_text(d, track_album, fonts["album"], max_px), font=fonts["album"], fill=DIM)
        # Stats block.
        sy = 330
        if top_artist:
            plays = f"{top_artist_plays:,} plays" if top_artist_plays else "top artist (7d)"
            d.text((x, sy), "TOP ARTIST (7D)", font=fonts["label"], fill=DIM)
            d.text((x, sy + 26), _fit_text(d, f"{top_artist} — {plays}", fonts["stats"], max_px), font=fonts["stats"], fill=WHITE)
            sy += 60
        if total_plays:
            d.text((x, sy), _fit_text(d, f"TOTAL SCROBBLES  {total_plays:,}", fonts["stats"], max_px), font=fonts["stats"], fill=WHITE)
        # Invite footer (visual only — clickable link goes in the message).
        if invite_url:
            short = invite_url.replace("https://", "")
            d.text((44, H - 44), _fit_text(d, f"Join me: {short}", fonts["invite"], W - 88), font=fonts["invite"], fill=ACCENT)
        d.text((W - 150, H - 40), "DJ Scratch", font=fonts["footer"], fill=DIM)
        return base

    card = await asyncio.to_thread(_compose, card)
    buffer = io.BytesIO()
    card.save(buffer, format="JPEG", quality=85)
    buffer.seek(0)
    return buffer

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
