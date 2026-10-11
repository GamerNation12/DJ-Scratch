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


def _paginate_lyrics(plain: str, per_page: int = 1000) -> list:
    """Split lyrics into page chunks on blank lines (hard-split runaways)."""
    text = (plain or "").strip().replace("\r\n", "\n")
    if not text:
        return []
    paras = [p.strip() for p in text.split("\n\n")]
    pages, current = [], ""
    for p in paras:
        while len(p) > per_page:
            if current:
                pages.append(current)
                current = ""
            pages.append(p[:per_page])
            p = p[per_page:]
        candidate = f"{current}\n\n{p}".strip() if current else p
        if len(candidate) > per_page and current:
            pages.append(current)
            current = p
        else:
            current = candidate
    if current:
        pages.append(current)
    return [pg for pg in pages if pg]


class LyricsPagesView(discord.ui.View):
    """◀ ▶ pager so long lyrics aren't a wall of text."""

    def __init__(self, artist: str, track: str, plain: str):
        super().__init__(timeout=300)
        self.artist = artist
        self.track = track
        self.pages = _paginate_lyrics(plain)
        self.index = 0
        self.prev_btn = discord.ui.Button(emoji="◀", style=discord.ButtonStyle.secondary)
        self.prev_btn.callback = self._prev
        self.page_btn = discord.ui.Button(label="1/1", style=discord.ButtonStyle.secondary, disabled=True)
        self.next_btn = discord.ui.Button(emoji="▶", style=discord.ButtonStyle.secondary)
        self.next_btn.callback = self._next
        for item in (self.prev_btn, self.page_btn, self.next_btn):
            self.add_item(item)
        self._sync()

    @property
    def has_pages(self) -> bool:
        return len(self.pages) > 1

    def _sync(self):
        total = max(1, len(self.pages))
        self.page_btn.label = f"{min(self.index + 1, total)}/{total}"
        self.prev_btn.disabled = self.index <= 0
        self.next_btn.disabled = self.index >= len(self.pages) - 1

    def page_embed(self):
        if not self.pages:
            return lyrics_embed(self.artist, self.track, None)
        return lyrics_page_embed(self.artist, self.track, self.pages[self.index], self.index, len(self.pages))

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
