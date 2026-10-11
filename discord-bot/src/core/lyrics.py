from src.core.config import Log
import discord
import aiohttp
import urllib.parse

from src.core.database import format_name


async def fetch_lyrics(session: aiohttp.ClientSession, artist: str, song: str):
    """
    Fetches lyrics using the free lrclib.net service.
    Returns the lyrics string if found, else None.
    """
    url = "https://lrclib.net/api/get"
    params = {
        "artist_name": artist,
        "track_name": song
    }
    
    try:
        if session is None:
            return None
        timeout = aiohttp.ClientTimeout(total=8)
        for _ in range(2):
            try:
                async with session.get(url, params=params, timeout=timeout) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return {
                            "synced": data.get("syncedLyrics"),
                            "plain": data.get("plainLyrics")
                        }
                    return None
            except Exception:
                continue
    except Exception as e:
        print(f"{Log.RED}>>> Failed to fetch lyrics: {e}{Log.RESET}")

    return None


def lyrics_embed(artist: str, track: str, plain: str | None):
    """fmbot-style lyrics card: linked 'Lyrics for Artist - Track' title, full body."""
    from src.core.theme import Theme
    body = (plain or "").strip()
    if len(body) > 4000:
        body = body[:4000].rstrip() + "\n\n*…showing the first part*"
    track_url = f"https://www.last.fm/music/{urllib.parse.quote(artist or '')}/_/{urllib.parse.quote(track or '')}"
    return Theme.get_embed(
        title=f"Lyrics for {artist} - {track}",
        url=track_url,
        description=body or "No lyrics found.",
        color=0x2B2D31,
    )


def lyrics_page_embed(artist: str, track: str, chunk: str, page: int, pages: int):
    """One page of the lyrics card."""
    from src.core.theme import Theme
    track_url = f"https://www.last.fm/music/{urllib.parse.quote(artist or '')}/_/{urllib.parse.quote(track or '')}"
    embed = Theme.get_embed(
        title=f"Lyrics for {artist} - {track}",
        url=track_url,
        description=chunk,
        color=0x2B2D31,
    )
    embed.set_footer(text=f"Page {page + 1}/{pages} • {Theme.FOOTER_TEXT}")
    return embed


def _parse_synced(synced: str | None) -> list:
    """[(seconds, text)] from lrclib [mm:ss.xx] lines."""
    import re
    out = []
    for line in (synced or "").splitlines():
        m = re.match(r"^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$", line.strip())
        if m:
            try:
                out.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
            except Exception:
                continue
    return out


def _lev(a: str, b: str) -> int:
    """Tiny Levenshtein for lyric-line alignment."""
    a, b = (a or "").strip().lower(), (b or "").strip().lower()
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if abs(la - lb) > 2 and (not a or not b):
        return 99
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i]
        for j in range(1, lb + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1])))
        prev = cur
    return prev[lb]


def _fmt_ts(seconds: float) -> str:
    total = max(0, int(seconds))
    return f"{total // 60}:{total % 60:02d}"


def _paginate_lyrics(plain: str, synced: str | None, per_page: int = 20) -> list:
    """20 plain lines per page; each page tracks its synced time range."""
    text = (plain or "").strip().replace("\r\n", "\n")
    if not text:
        return []
    lines = text.split("\n")
    synced_entries = _parse_synced(synced)
    pages = []
    idx = 0
    for i in range(0, len(lines), per_page):
        chunk = lines[i:i + per_page]
        start = end = None
        if synced_entries:
            try:
                if idx < len(synced_entries):
                    start = synced_entries[idx][0]
                for line in chunk:
                    if not line.strip():
                        continue
                    if idx >= len(synced_entries):
                        break
                    entry_text = synced_entries[idx][1]
                    if _lev(entry_text, line) > 2:
                        idx += 1
                        if idx >= len(synced_entries):
                            break
                    end = synced_entries[idx][0]
                    idx += 1
            except Exception:
                pass
        pages.append({"text": "\n".join(chunk).strip(), "start": start, "end": end})
    return [p for p in pages if p["text"]]


class LyricsPagesView(discord.ui.View):
    """fmbot-style pager: prev/next + page time-range label."""

    def __init__(self, artist: str, track: str, plain: str, synced: str | None = None):
        super().__init__(timeout=300)
        self.artist = artist
        self.track = track
        self.pages = _paginate_lyrics(plain, synced)
        self.index = 0
        self.prev_btn = discord.ui.Button(emoji="◀", style=discord.ButtonStyle.secondary)
        self.prev_btn.callback = self._prev
        self.time_btn = discord.ui.Button(
            label=self._time_label(), style=discord.ButtonStyle.secondary, disabled=True)
        self.next_btn = discord.ui.Button(emoji="▶", style=discord.ButtonStyle.secondary)
        self.next_btn.callback = self._next
        self.add_item(self.prev_btn)
        if self._time_label():
            self.add_item(self.time_btn)
        self.add_item(self.next_btn)
        self._sync()

    @property
    def has_pages(self) -> bool:
        return len(self.pages) > 1

    def _time_label(self) -> str:
        if not self.pages:
            return ""
        page = self.pages[min(self.index, len(self.pages) - 1)]
        if page["start"] is None or page["end"] is None:
            return ""
        return f"{_fmt_ts(page['start'])} until {_fmt_ts(page['end'] + 3)}"

    def _sync(self):
        self.prev_btn.disabled = self.index <= 0
        self.next_btn.disabled = self.index >= len(self.pages) - 1
        try:
            self.time_btn.label = self._time_label() or "•"
        except Exception:
            pass

    def page_embed(self):
        if not self.pages:
            return lyrics_embed(self.artist, self.track, None)
        page = self.pages[self.index]
        return lyrics_page_embed(self.artist, self.track, page["text"], self.index, len(self.pages))

    async def _go(self, interaction: discord.Interaction, index: int):
        self.index = max(0, min(index, len(self.pages) - 1))
        self._sync()
        try:
            await interaction.response.edit_message(embed=self.page_embed(), view=self)
        except discord.errors.NotFound:
            pass

    async def _prev(self, interaction: discord.Interaction):
        await self._go(interaction, self.index - 1)

    async def _next(self, interaction: discord.Interaction):
        await self._go(interaction, self.index + 1)
