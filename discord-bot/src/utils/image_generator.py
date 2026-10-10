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


def _autofit_name(draw: ImageDraw.ImageDraw, text: str, max_px: int):
    """Largest bold size (52→34) that fits — container fonts vary in width."""
    for size in (52, 48, 44, 40, 36, 32):
        font = _load_font_bold(size)
        try:
            if draw.textlength(text, font=font) <= max_px:
                return font
        except Exception:
            return font
    return _load_font_bold(32)


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
    avatar_url: str = "",
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
    animated: bool = True,
) -> io.BytesIO:
    """Shareable stats music card (1000x720; GIF when playing, JPEG when not).

    Ground-up pro UI: blurred art backdrop with gradient, glass stat chips,
    status pill, avatar, rounded art. The playing
    version loops a cheap equalizer (frames share one base render). Purely
    visual — the clickable invite link travels in the message content.
    """
    W, H = 1000, 720
    ACCENT = (10, 181, 205)
    WHITE = (245, 245, 245)
    GRAY = (190, 190, 200)
    DIM = (150, 150, 160)
    GOLD = (241, 196, 15)
    INK = (10, 12, 16)

    def _fonts():
        return {
            "name": _load_font_bold(48),
            "total": _load_font_bold(34),
            "total_label": _load_font_bold(18),
            "handle": _load_font("", 26),
            "badges": _load_font("", 22),
            "label": _load_font_bold(20),
            "pill": _load_font_bold(19),
            "title": _load_font_bold(36),
            "artist": _load_font("", 28),
            "album": _load_font("", 24),
            "plays": _load_font_bold(22),
            "chip_label": _load_font_bold(17),
            "chip_val": _load_font_bold(23),
            "chip_sub": _load_font("", 19),
            "invite": _load_font("", 21),
            "footer": _load_font("", 19),
        }

    fonts = await asyncio.to_thread(_fonts)

    # Artwork: backdrop + thumb. Avatar: header identity.
    try:
        art_full = await download_image(session, art_url)
        art_full = art_full.convert("RGB")
    except Exception:
        art_full = Image.new("RGB", (400, 400), color=(34, 34, 40))
    try:
        avatar = await download_image(session, avatar_url) if avatar_url else None
        if avatar is not None:
            avatar = avatar.convert("RGB").resize((104, 104), Image.Resampling.LANCZOS)
    except Exception:
        avatar = None

    def _base() -> Image.Image:
        bg = art_full.resize((W, H), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(30))
        card = Image.blend(bg, Image.new("RGB", (W, H), color=(8, 8, 12)), 0.55)
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for yy in range(H):
            od.line([(0, yy), (W, yy)], fill=(5, 5, 10, int(60 + 115 * yy / H)))
        for bx0 in (48, 275, 502, 729):
            od.rounded_rectangle([(bx0, 492), (bx0 + 211, 596)], radius=18,
                                 fill=(255, 255, 255, 16), outline=(255, 255, 255, 30), width=2)
        card = Image.alpha_composite(card.convert("RGBA"), ov).convert("RGB")
        d = ImageDraw.Draw(card)
        d.rectangle([(0, 0), (12, H)], fill=ACCENT)
        return card

    def _round_paste(base: Image.Image, img: Image.Image, box, radius: int):
        mask = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0)
        ImageDraw.Draw(mask).rounded_rectangle([(0, 0), mask.size], radius=radius, fill=255)
        base.paste(img, box[:2], mask)

    def _circle_paste(base: Image.Image, img: Image.Image, xy, diameter: int):
        mask = Image.new("L", (diameter, diameter), 0)
        ImageDraw.Draw(mask).ellipse([(0, 0), (diameter, diameter)], fill=255)
        base.paste(img, xy, mask)

    def _right(d: ImageDraw.ImageDraw, x_right: int, y: int, text: str, font, fill):
        try:
            w = d.textlength(text, font=font)
        except Exception:
            w = len(text) * 12
        d.text((x_right - w, y), text, font=font, fill=fill)

    card = await asyncio.to_thread(_base)
    if avatar is not None:
        await asyncio.to_thread(_circle_paste, card, avatar, (48, 40), 104)
    thumb = await asyncio.to_thread(art_full.resize, (260, 260), Image.Resampling.LANCZOS)
    await asyncio.to_thread(_round_paste, card, thumb, (48, 204, 308, 464), 28)
    draw = ImageDraw.Draw(card)

    x = 340
    right = W - 48
    max_px = right - x

    # Header.
    nx = 168 if avatar is not None else 48
    name_max = (right - nx) - (200 if total_plays else 0)
    name_font = _autofit_name(draw, display_name or "Unknown", name_max)
    draw.text((nx, 44), display_name or "Unknown", font=name_font, fill=WHITE)
    hy = 108
    if lastfm_username:
        draw.text((nx, hy), _fit_text(draw, f"@{lastfm_username}", fonts["handle"], right - nx), font=fonts["handle"], fill=GRAY)
        hy += 36
    if badge_names:
        draw.text((nx, hy), _fit_text(draw, "  •  ".join(badge_names), fonts["badges"], right - nx), font=fonts["badges"], fill=GOLD)
    if total_plays:
        _right(draw, right, 44, f"{total_plays:,}", fonts["total"], WHITE)
        _right(draw, right, 86, "SCROBBLES", fonts["total_label"], DIM)
        _right(draw, right, 112, "DJ SCRATCH", fonts["footer"], ACCENT)

    # Divider.
    draw.line([(48, 178), (right, 178)], fill=(255, 255, 255, 28), width=2)

    # Track spotlight with status pill.
    pill_text = "NOW PLAYING" if is_playing else "LAST PLAYED"
    try:
        pill_w = draw.textlength(pill_text, font=fonts["pill"])
    except Exception:
        pill_w = 150
    py, ph = 204, 32
    if is_playing:
        draw.rounded_rectangle([(x, py), (x + pill_w + 40, py + ph)], radius=16, fill=ACCENT)
        draw.text((x + 20, py + 5), pill_text, font=fonts["pill"], fill=INK)
        eq_x, eq_base = x + pill_w + 56, py + 27
    else:
        draw.rounded_rectangle([(x, py), (x + pill_w + 40, py + ph)], radius=16, outline=DIM, width=2)
        draw.text((x + 20, py + 5), pill_text, font=fonts["pill"], fill=DIM)
        eq_x = eq_base = 0
    title_lines = _wrap_text(draw, _strip_feat(track_title) or track_title, fonts["title"], max_px, 2)
    ty = py + 44
    for line in title_lines or [_fit_text(draw, track_title or "Unknown track", fonts["title"], max_px)]:
        draw.text((x, ty), line, font=fonts["title"], fill=WHITE)
        ty += 42
    draw.text((x, ty + 2), _fit_text(draw, track_artist or "Unknown artist", fonts["artist"], max_px), font=fonts["artist"], fill=GRAY)
    ty += 40
    if track_album:
        draw.text((x, ty), _fit_text(draw, track_album, fonts["album"], max_px), font=fonts["album"], fill=DIM)
        ty += 32
    if track_plays:
        draw.text((x, ty), f"My plays  {track_plays:,}", font=fonts["plays"], fill=ACCENT)

    # Glass stat chips.
    chips = [
        ("TOP TRACK (7D)", top_track, top_track_plays),
        ("TOP ARTIST (7D)", top_artist, top_artist_plays),
        ("TOP ALBUM (7D)", top_album, top_album_plays),
        ("LAST 24H", "", 0),
    ]
    for i, (label, name, plays) in enumerate(chips):
        cx = (48, 275, 502, 729)[i]
        draw.text((cx + 18, 504), label, font=fonts["chip_label"], fill=DIM)
        if i == 3:
            draw.text((cx + 18, 528), f"{plays_24h:,}", font=fonts["chip_val"], fill=WHITE)
            draw.text((cx + 18, 556), "plays", font=fonts["chip_sub"], fill=GRAY)
        else:
            val = name or "—"
            draw.text((cx + 18, 528), _fit_text(draw, val, fonts["chip_val"], 175), font=fonts["chip_val"], fill=WHITE)
            draw.text((cx + 18, 556), f"{plays:,} plays" if plays else "this week", font=fonts["chip_sub"], fill=GRAY)

    # Invite footer (visual only — clickable link goes in the message).
    if invite_url:
        short = invite_url.replace("https://", "")
        draw.text((52, H - 68), "JOIN WITH MY INVITE — WE BOTH EARN A BADGE", font=fonts["label"], fill=ACCENT)
        draw.text((52, H - 42), _fit_text(draw, short, fonts["invite"], W - 104), font=fonts["invite"], fill=WHITE)

    if animated and is_playing and eq_x:
        return await asyncio.to_thread(_animate_card, card, eq_x, eq_base)
    buffer = io.BytesIO()
    await asyncio.to_thread(card.save, buffer, format="JPEG", quality=88)
    buffer.seek(0)
    return buffer


def _animate_card(base: Image.Image, eq_x: int, eq_base: int) -> io.BytesIO:
    """Loop a small equalizer by the status pill. Frames share one base."""
    import math
    bars, gap, bw = 5, 7, 9
    frames = []
    for f in range(10):
        frame = base.copy()
        d = ImageDraw.Draw(frame)
        for i in range(bars):
            h = 6 + int(24 * abs(math.sin(f * 0.9 + i * 1.7)))
            x0 = eq_x + i * (bw + gap)
            shade = 120 + int(120 * (h / 30))
            d.rounded_rectangle([(x0, eq_base - h), (x0 + bw, eq_base)], radius=4,
                                fill=(10, min(255, 120 + shade // 3), min(255, 150 + shade // 2)))
        frames.append(frame.convert("RGB"))
    buffer = io.BytesIO()
    frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:],
                   duration=110, loop=0)
    buffer.seek(0)
    return buffer

async def generate_recap_image(
    session: aiohttp.ClientSession,
    *,
    display_name: str,
    period_title: str = "YOUR WEEK IN MUSIC",
    period_label: str = "",
    total_plays: int = 0,
    total_capped: bool = False,
    top_tracks: list | None = None,   # [(title, artist, plays, img_url)]
    top_artists: list | None = None,  # [(name, plays)]
    top_albums: list | None = None,   # [(name, artist, plays)]
    discoveries: list | None = None,  # [artist names]
    invite_url: str = "",
) -> io.BytesIO:
    """stats.fm-style recap (1000px wide, dynamic height, JPEG)."""
    W = 1000
    ACCENT = (10, 181, 205)
    WHITE = (245, 245, 245)
    GRAY = (190, 190, 200)
    DIM = (150, 150, 160)
    GOLD = (241, 196, 15)

    top_tracks = top_tracks or []
    top_artists = top_artists or []
    top_albums = top_albums or []
    discoveries = discoveries or []

    def _fonts():
        return {
            "hero": _load_font_bold(72),
            "hero_label": _load_font_bold(22),
            "name": _load_font_bold(40),
            "period": _load_font("", 24),
            "section": _load_font_bold(22),
            "rank": _load_font_bold(28),
            "track": _load_font_bold(27),
            "sub": _load_font("", 23),
            "plays": _load_font_bold(24),
            "invite": _load_font("", 21),
            "footer": _load_font("", 19),
        }

    fonts = await asyncio.to_thread(_fonts)

    # Thumbnails for the top tracks (max 3 concurrent, like charts).
    # Missing Last.fm art falls back to an iTunes song search so covers
    # rarely end up blank (the old star placeholder is gone).
    thumbs: list = []
    try:
        sem = asyncio.Semaphore(3)

        async def _itunes_song_art(artist, title):
            try:
                import urllib.parse
                query = urllib.parse.quote(f"{artist or ''} {title or ''}".strip())
                if not query:
                    return ""
                async with session.get(
                    f"https://itunes.apple.com/search?term={query}&entity=song&limit=1",
                    timeout=5,
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        if data.get("results"):
                            return (data["results"][0].get("artworkUrl100", "")
                                    .replace("100x100bb", "600x600bb"))
            except Exception:
                pass
            return ""

        async def _one(t):
            url = t[3] if len(t) > 3 else ""
            title = t[0] if len(t) > 0 else ""
            artist = t[1] if len(t) > 1 else ""
            async with sem:
                try:
                    if not url:
                        url = await _itunes_song_art(artist, title)
                    if not url:
                        return Image.new("RGB", (104, 104), color=(34, 34, 40))
                    img = await download_image(session, url)
                    return img.convert("RGB").resize((104, 104), Image.Resampling.LANCZOS)
                except Exception:
                    return Image.new("RGB", (104, 104), color=(34, 34, 40))

        thumbs = await asyncio.gather(*[_one(t) for t in top_tracks[:5]])
    except Exception:
        thumbs = [Image.new("RGB", (104, 104), color=(34, 34, 40)) for _ in top_tracks[:5]]

    # Artist + album thumbnails (Deezer artist pics / iTunes album art).
    artist_thumbs: list = []
    album_thumbs: list = []
    try:
        async def _deezer_artist_art(artist):
            try:
                import urllib.parse
                q = urllib.parse.quote((artist or "").strip())
                if not q:
                    return ""
                async with session.get(f"https://api.deezer.com/search/artist?q={q}", timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        results = data.get("data") or []
                        if results:
                            return results[0].get("picture_big") or results[0].get("picture_medium") or ""
            except Exception:
                pass
            return ""

        async def _art_one(url, artist, album, size, artist_only=False):
            async with sem:
                try:
                    if not url and artist_only:
                        url = await _deezer_artist_art(artist)
                    if not url:
                        return Image.new("RGB", (size, size), color=(34, 34, 40))
                    img = await download_image(session, url, artist, album)
                    return img.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
                except Exception:
                    return Image.new("RGB", (size, size), color=(34, 34, 40))

        artist_thumbs = await asyncio.gather(*[
            _art_one("", (a[0] if len(a) > 0 else ""), None, 56, artist_only=True)
            for a in top_artists[:5]
        ])
        album_thumbs = await asyncio.gather(*[
            _art_one(a[3] if len(a) > 3 else "", (a[1] if len(a) > 1 else ""),
                     (a[0] if len(a) > 0 else ""), 72)
            for a in top_albums[:3]
        ])
    except Exception:
        artist_thumbs = [Image.new("RGB", (56, 56), color=(34, 34, 40)) for _ in top_artists[:5]]
        album_thumbs = [Image.new("RGB", (72, 72), color=(34, 34, 40)) for _ in top_albums[:3]]

    row_track, row_artist, row_album = 132, 76, 96
    H = (200 + 130 + len(top_tracks[:5]) * row_track + 50
         + len(top_artists[:5]) * row_artist + 50
         + len(top_albums[:3]) * row_album + 50
         + (100 if discoveries else 0) + 120)

    # Blurred-artwork backdrop like the share card (top track art, else top
    # album art, else flat). Heavy blur + dark blend keeps text readable.
    try:
        burl = ""
        for t in top_tracks[:3]:
            if len(t) > 3 and t[3]:
                burl = t[3]
                break
        if not burl:
            for a in top_albums[:3]:
                if len(a) > 3 and a[3]:
                    burl = a[3]
                    break
        if burl:
            bimg = await download_image(session, burl)
            card = await asyncio.to_thread(_recap_backdrop, bimg, W, H)
        else:
            card = Image.new("RGB", (W, H), color=(14, 14, 18))
    except Exception:
        card = Image.new("RGB", (W, H), color=(14, 14, 18))
    draw = ImageDraw.Draw(card)
    draw.rectangle([(0, 0), (12, H)], fill=ACCENT)

    def _mask(size, radius):
        m = Image.new("L", size, 0)
        ImageDraw.Draw(m).rounded_rectangle([(0, 0), size], radius=radius, fill=255)
        return m

    y = 36
    draw.text((48, y), _fit_text(draw, display_name or "Unknown", fonts["name"], W - 96),
              font=fonts["name"], fill=WHITE)
    y += 56
    if period_label:
        draw.text((48, y), period_label, font=fonts["period"], fill=GRAY)
        y += 36
    draw.text((48, y), period_title, font=fonts["section"], fill=ACCENT)
    y += 40
    total_txt = f"{total_plays:,}{'+' if total_capped else ''}"
    try:
        tw = draw.textlength(total_txt, font=fonts["hero"])
    except Exception:
        tw = 200
    draw.text((48, y), total_txt, font=fonts["hero"], fill=WHITE)
    draw.text((48 + tw + 18, y + 38), "PLAYS", font=fonts["hero_label"], fill=DIM)
    y += 110

    # Top tracks with thumbnails.
    if top_tracks:
        draw.text((48, y), "TOP TRACKS", font=fonts["section"], fill=DIM)
        y += 36
        for i, t in enumerate(top_tracks[:5]):
            title, artist = (t[0] if len(t) > 0 else ""), (t[1] if len(t) > 1 else "")
            plays = t[2] if len(t) > 2 else 0
            if i < len(thumbs):
                card.paste(thumbs[i], (48, y), _mask((104, 104), 20))
            try:
                rw = draw.textlength(f"{i + 1}", font=fonts["rank"])
            except Exception:
                rw = 20
            draw.text((168, y + 8), f"{i + 1}", font=fonts["rank"], fill=DIM)
            tx = 168 + rw + 16
            draw.text((tx, y + 2), _fit_text(draw, title or "Unknown", fonts["track"], 560), font=fonts["track"], fill=WHITE)
            draw.text((tx, y + 42), _fit_text(draw, artist or "Unknown", fonts["sub"], 560), font=fonts["sub"], fill=GRAY)
            try:
                pw = draw.textlength(f"{plays:,}", font=fonts["plays"])
            except Exception:
                pw = 60
            draw.text((W - 48 - pw, y + 36), f"{plays:,}", font=fonts["plays"], fill=WHITE)
            y += row_track
        y += 18

    # Top artists with thumbnails + bars.
    if top_artists:
        draw.text((48, y), "TOP ARTISTS", font=fonts["section"], fill=DIM)
        y += 36
        amax = max([p for _, p in top_artists[:5]] + [1])
        for i, apair in enumerate(top_artists[:5]):
            name = apair[0] if len(apair) > 0 else ""
            plays = apair[1] if len(apair) > 1 else 0
            if i < len(artist_thumbs):
                card.paste(artist_thumbs[i], (48, y), _mask((56, 56), 14))
            draw.text((120, y + 2), _fit_text(draw, name or "Unknown", fonts["track"], 340),
                      font=fonts["track"], fill=WHITE)
            bw = int(300 * (plays / amax)) if amax else 0
            draw.rounded_rectangle([(470, y + 8), (470 + max(8, bw), y + 26)], radius=9, fill=ACCENT)
            try:
                pw = draw.textlength(f"{plays:,}", font=fonts["plays"])
            except Exception:
                pw = 60
            draw.text((W - 48 - pw, y + 4), f"{plays:,}", font=fonts["plays"], fill=GRAY)
            y += row_artist
        y += 18

    # Top albums with covers.
    if top_albums:
        draw.text((48, y), "TOP ALBUMS", font=fonts["section"], fill=DIM)
        y += 36
        for i, a in enumerate(top_albums[:3]):
            name, artist, plays = (a[0] if len(a) > 0 else ""), (a[1] if len(a) > 1 else ""), (a[2] if len(a) > 2 else 0)
            if i < len(album_thumbs):
                card.paste(album_thumbs[i], (48, y), _mask((72, 72), 16))
            draw.text((136, y + 4), _fit_text(draw, name or "Unknown", fonts["track"], 560),
                      font=fonts["track"], fill=WHITE)
            draw.text((136, y + 40), _fit_text(draw, artist or "Unknown", fonts["sub"], 560),
                      font=fonts["sub"], fill=GRAY)
            try:
                pw = draw.textlength(f"{plays:,}", font=fonts["plays"])
            except Exception:
                pw = 60
            draw.text((W - 48 - pw, y + 22), f"{plays:,}", font=fonts["plays"], fill=GRAY)
            y += row_album
        y += 18

    # New discoveries.
    if discoveries:
        draw.text((48, y), "NEW FINDS", font=fonts["section"], fill=GOLD)
        y += 36
        draw.text((48, y), _fit_text(draw, "  •  ".join(discoveries[:5]), fonts["sub"], W - 96),
                  font=fonts["sub"], fill=WHITE)
        y += 64

    # Footer.
    if invite_url:
        short = invite_url.replace("https://", "")
        draw.text((48, H - 68), "SHARED FROM DJ SCRATCH", font=fonts["section"], fill=ACCENT)
        draw.text((48, H - 42), _fit_text(draw, short, fonts["invite"], W - 104), font=fonts["invite"], fill=WHITE)

    buffer = io.BytesIO()
    await asyncio.to_thread(card.save, buffer, format="JPEG", quality=86)
    buffer.seek(0)
    return buffer


def _recap_backdrop(bimg: Image.Image, W: int, H: int) -> Image.Image:
    """Backdrop resize + heavy blur + dark blend. CPU-bound: call via to_thread."""
    bimg = (bimg.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
            .filter(ImageFilter.GaussianBlur(40)))
    card = Image.blend(bimg, Image.new("RGB", (W, H), color=(10, 10, 16)), 0.62)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for yy in range(0, H, 4):
        od.line([(0, yy), (W, yy)], fill=(5, 5, 10, int(70 + 110 * yy / H)))
    return Image.alpha_composite(card.convert("RGBA"), ov).convert("RGB")


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

    # Artist cells have no album: use the artist picture instead.
    if (not url or '2a96cbd8' in url or '4128a6eb' in url) and artist and not album:
        try:
            import urllib.parse
            query = urllib.parse.quote(artist)
            async with session.get(f"https://api.deezer.com/search/artist?q={query}", timeout=5) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    results = data.get('data') or []
                    if results:
                        url = results[0].get('picture_big') or results[0].get('picture_medium') or url
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

def _render_cell(img: Image.Image, item, cell_size, font_primary, font_secondary, show_text) -> Image.Image:
    """Cell resize + text overlay. CPU-bound: call via to_thread."""
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

    return img


async def _process_cell(session, item, idx, columns, cell_size, chart, font_primary, font_secondary, show_text, semaphore):
    async with semaphore:
        img = await download_image(session, item.get('image_url'), item.get('fallback_artist'), item.get('fallback_album'))

        row = idx // columns
        col = idx % columns

        img = await asyncio.to_thread(
            _render_cell, img, item, cell_size, font_primary, font_secondary, show_text)

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
    await asyncio.to_thread(chart.save, buffer, format='JPEG', quality=85)
    buffer.seek(0)
    return buffer
