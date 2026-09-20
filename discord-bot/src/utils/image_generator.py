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


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_px: int, max_lines: int = 2) -> list:
    """Greedy word-wrap for card titles that deserve a second line."""
    words = (text or "").split()
    lines, current = [], ""
    for w in words:
        trial = f"{current} {w}".strip()
        try:
            too_wide = draw.textlength(trial, font=font) > max_px
        except Exception:
            too_wide = len(trial) > 40
        if too_wide and current:
            lines.append(current)
            current = w
        else:
            current = trial
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        extra = " ".join(lines[max_lines - 1:])
        lines = lines[:max_lines - 1]
        while len(extra) > 4:
            try:
                if draw.textlength(extra + "…", font=font) <= max_px:
                    break
            except Exception:
                break
            extra = extra[:-1].rstrip()
        lines.append((extra + "…") if extra else "")
    return [line for line in lines if line]


def _strip_feat(text: str) -> str:
    """'All I Do Is Win (feat. T-Pain, …)' -> 'All I Do Is Win' for display."""
    import re
    cleaned = re.sub(r"\s*[\(\[]\s*feat\.?.*?[\)\]]", "", text or "", flags=re.IGNORECASE).strip()
    return cleaned or (text or "").strip()


async def generate_music_card(
    session: aiohttp.ClientSession,
    *,
    display_name: str,
    lastfm_username: str = "",
    badge_names: List[str] | None = None,
    track_title: str = "",
    track_artist: str = "",
    track_album: str = "",
    track_plays: int = 0,
    art_url: str = "",
    is_playing: bool = False,
    top_artist: str = "",
    top_artist_plays: int = 0,
    top_track: str = "",
    top_track_plays: int = 0,
    top_album: str = "",
    top_album_plays: int = 0,
    plays_24h: int = 0,
    total_plays: int = 0,
    invite_url: str = "",
) -> io.BytesIO:
    """Shareable stats music card (1000x640 JPEG, Wrapped-style).

    Blurred album-art backdrop, rounded art thumb, track spotlight, 7-day
    stats grid. Purely visual — the clickable invite link travels in the
    message content alongside the image, since images can't carry links.
    """
    W, H = 1000, 680
    ACCENT = (10, 181, 205)
    WHITE = (245, 245, 245)
    GRAY = (185, 185, 195)
    DIM = (140, 140, 150)
    GOLD = (241, 196, 15)

    def _fonts():
        return {
            "name": _load_font_bold(48),
            "total": _load_font_bold(34),
            "total_label": _load_font_bold(18),
            "handle": _load_font("", 26),
            "badges": _load_font("", 22),
            "label": _load_font_bold(20),
            "title": _load_font_bold(34),
            "artist": _load_font("", 28),
            "album": _load_font("", 24),
            "plays": _load_font_bold(22),
            "stat_val": _load_font_bold(25),
            "stat_name": _load_font("", 22),
            "invite": _load_font("", 21),
            "footer": _load_font("", 19),
        }

    fonts = await asyncio.to_thread(_fonts)

    # Artwork: full-size for the blurred backdrop, thumb for the spotlight.
    try:
        art_full = await download_image(session, art_url)
        art_full = art_full.convert("RGB")
    except Exception:
        art_full = Image.new("RGB", (400, 400), color=(34, 34, 40))

    def _base() -> Image.Image:
        bg = art_full.resize((W, H), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(28))
        black = Image.new("RGB", (W, H), color=(8, 8, 12))
        card = Image.blend(bg, black, 0.68)
        d = ImageDraw.Draw(card)
        d.rectangle([(0, 0), (12, H)], fill=ACCENT)
        return card

    def _round_paste(base: Image.Image, img: Image.Image, box, radius: int):
        mask = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0)
        ImageDraw.Draw(mask).rounded_rectangle([(0, 0), mask.size], radius=radius, fill=255)
        base.paste(img, box[:2], mask)

    def _right(d: ImageDraw.ImageDraw, x_right: int, y: int, text: str, font, fill):
        try:
            w = d.textlength(text, font=font)
        except Exception:
            w = len(text) * 12
        d.text((x_right - w, y), text, font=font, fill=fill)

    card = await asyncio.to_thread(_base)
    thumb = art_full.resize((280, 280), Image.Resampling.LANCZOS)
    await asyncio.to_thread(_round_paste, card, thumb, (52, 218, 332, 498), 26)
    draw = ImageDraw.Draw(card)

    x = 366
    right = W - 48
    max_px = right - x

    # Header (name reserves room for the total top-right).
    name_max = max_px - (190 if total_plays else 0)
    draw.text((x, 34), _fit_text(draw, display_name or "Unknown", fonts["name"], name_max), font=fonts["name"], fill=WHITE)
    hy = 100
    if lastfm_username:
        draw.text((x, hy), _fit_text(draw, f"@{lastfm_username}", fonts["handle"], max_px), font=fonts["handle"], fill=GRAY)
        hy += 36
    if badge_names:
        draw.text((x, hy), _fit_text(draw, "  •  ".join(badge_names), fonts["badges"], max_px), font=fonts["badges"], fill=GOLD)
    if total_plays:
        _right(draw, right, 44, f"{total_plays:,}", fonts["total"], WHITE)
        _right(draw, right, 86, "SCROBBLES", fonts["total_label"], DIM)

    # Track spotlight.
    ty = 218
    draw.text((x, ty), "NOW PLAYING" if is_playing else "LAST PLAYED", font=fonts["label"], fill=ACCENT if is_playing else DIM)
    title_lines = _wrap_text(draw, _strip_feat(track_title) or track_title, fonts["title"], max_px, 2)
    ty += 30
    for line in title_lines or [_fit_text(draw, track_title or "Unknown track", fonts["title"], max_px)]:
        draw.text((x, ty), line, font=fonts["title"], fill=WHITE)
        ty += 40
    draw.text((x, ty + 4), _fit_text(draw, track_artist or "Unknown artist", fonts["artist"], max_px), font=fonts["artist"], fill=GRAY)
    ty += 42
    if track_album:
        draw.text((x, ty), _fit_text(draw, track_album, fonts["album"], max_px), font=fonts["album"], fill=DIM)
        ty += 34
    if track_plays:
        draw.text((x, ty), f"My plays  {track_plays:,}", font=fonts["plays"], fill=ACCENT)

    # 7-day stats grid (2 x 2).
    stats = [
        ("TOP TRACK", top_track, top_track_plays),
        ("TOP ARTIST", top_artist, top_artist_plays),
        ("TOP ALBUM", top_album, top_album_plays),
        ("LAST 24H", f"{plays_24h:,} plays" if plays_24h or plays_24h == 0 else "", 0),
    ]
    col_x = (52, 520)
    row_y = (514, 578)
    for i, (label, name, plays) in enumerate(stats):
        cx, cy = col_x[i % 2], row_y[i // 2]
        cw = 440
        draw.text((cx, cy), label, font=fonts["label"], fill=DIM)
        if i == 3:
            draw.text((cx, cy + 24), name, font=fonts["stat_val"], fill=WHITE)
        else:
            val = f"{name} — {plays:,} plays" if name and plays else (name or "—")
            draw.text((cx, cy + 24), _fit_text(draw, val, fonts["stat_val"], cw), font=fonts["stat_val"], fill=WHITE)

    # Invite footer (visual only — clickable link goes in the message).
    if invite_url:
        short = invite_url.replace("https://", "")
        draw.text((52, H - 44), _fit_text(draw, f"Join me: {short}", fonts["invite"], 640), font=fonts["invite"], fill=ACCENT)
    draw.text((W - 150, H - 40), "DJ Scratch", font=fonts["footer"], fill=DIM)

    buffer = io.BytesIO()
    card.save(buffer, format="JPEG", quality=88)
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
