import discord
import asyncio
import re
from src.core.theme import Theme

def parse_synced_lyrics(synced_text: str):
    lines = []
    for line in synced_text.split('\n'):
        match = re.match(r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)', line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            millis = int(match.group(3))
            
            if len(match.group(3)) == 2:
                total_seconds = minutes * 60 + seconds + (millis / 100.0)
            else:
                total_seconds = minutes * 60 + seconds + (millis / 1000.0)
                
            text = match.group(4).strip()
            lines.append((total_seconds, text))
    return lines

class KaraokeLyricsView(discord.ui.LayoutView):
    def __init__(self, artist: str, song: str, synced_lyrics: str, plain_lyrics: str, start_time: float = 0.0):
        super().__init__(timeout=300)
        self.artist = artist
        self.song = song
        self.plain_lyrics = plain_lyrics
        self.lines = parse_synced_lyrics(synced_lyrics) if synced_lyrics else []
        
        self.is_playing = True if start_time > 0.0 else False
        self.current_time = start_time
        self.message: discord.Message = None
        self.update_task = None
        
        self.duration = self.lines[-1][0] + 10.0 if self.lines else 180.0
        
        # Setup buttons manually
        self.btn_rewind = discord.ui.Button(label="-10s", emoji="⏪", style=discord.ButtonStyle.secondary, custom_id="rewind")
        self.btn_rewind.callback = self._on_rewind
        
        self.btn_rewind_small = discord.ui.Button(label="-2s", emoji="◀️", style=discord.ButtonStyle.secondary, custom_id="rewind_small")
        self.btn_rewind_small.callback = self._on_rewind_small
        
        self.btn_forward_small = discord.ui.Button(label="+2s", emoji="▶️", style=discord.ButtonStyle.secondary, custom_id="forward_small")
        self.btn_forward_small.callback = self._on_forward_small
        
        self.btn_forward = discord.ui.Button(label="+10s", emoji="⏩", style=discord.ButtonStyle.secondary, custom_id="forward")
        self.btn_forward.callback = self._on_forward
        
        self.btn_play_pause = discord.ui.Button(label="Pause" if self.is_playing else "Play", emoji="⏸️" if self.is_playing else "▶️", style=discord.ButtonStyle.success if self.is_playing else discord.ButtonStyle.primary, custom_id="play_pause")
        self.btn_play_pause.callback = self._on_play_pause
        
        self.btn_stop = discord.ui.Button(label="Plain Text", emoji="⏹️", style=discord.ButtonStyle.danger, custom_id="stop")
        self.btn_stop.callback = self._on_stop
        
        if not self.lines:
            self.btn_rewind.disabled = True
            self.btn_rewind_small.disabled = True
            self.btn_forward_small.disabled = True
            self.btn_forward.disabled = True
            self.btn_play_pause.disabled = True
            self.btn_stop.disabled = True
            
        self._build_layout()
        
        if self.is_playing and self.lines:
            self.update_task = asyncio.create_task(self._update_loop())

    async def _update_loop(self):
        while self.is_playing:
            await asyncio.sleep(2.0)
            if self.is_playing:
                self.current_time += 2.0
                if self.current_time > self.duration:
                    self.is_playing = False
                    self.current_time = self.duration
                await self._edit_message()

    async def _edit_message(self):
        if not self.message:
            return
            
        self.btn_play_pause.label = "Pause" if self.is_playing else "Play"
        self.btn_play_pause.emoji = "⏸️" if self.is_playing else "▶️"
        self.btn_play_pause.style = discord.ButtonStyle.success if self.is_playing else discord.ButtonStyle.primary
        
        self._build_layout()
                
        try:
            await self.message.edit(embeds=[], view=self)
        except Exception:
            self.is_playing = False

    def _build_layout(self):
        self.clear_items()
        
        if not self.lines:
            desc = self.plain_lyrics or "No lyrics available."
            if len(desc) > 4096:
                desc = desc[:4093] + "..."
                
            section = discord.ui.Section(
                discord.ui.TextDisplay(f"Lyrics for {self.song} by {self.artist}"),
                discord.ui.TextDisplay(desc),
                accessory=discord.ui.Thumbnail("https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif")
            )
            container = discord.ui.Container(section, accent_color=Theme.PRIMARY)
            self.add_item(container)
            return
            
        active_idx = 0
        for i, (ts, text) in enumerate(self.lines):
            if ts <= self.current_time:
                active_idx = i
            else:
                break
                
        start_idx = max(0, active_idx - 3)
        end_idx = min(len(self.lines), active_idx + 6)
        
        display_lines = []
        for i in range(start_idx, end_idx):
            _, text = self.lines[i]
            if not text:
                text = "🎵"
                
            if i == active_idx:
                display_lines.append(f"**{text}**")
            elif i < active_idx:
                display_lines.append(f"*{text}*")
            else:
                display_lines.append(text)
                
        desc = "\n".join(display_lines)
        
        pct = min(1.0, self.current_time / self.duration)
        bar_len = 15
        filled = int(pct * bar_len)
        bar = "▬" * filled + "🔘" + "▬" * (bar_len - filled)
        
        mins, secs = divmod(int(self.current_time), 60)
        tmins, tsecs = divmod(int(self.duration), 60)
        
        footer_text = "Auto-syncing lyrics... (Updates every 2s)" if self.is_playing else "Paused. Use buttons to sync."
        desc += f"\n\n`{mins}:{secs:02d} {bar} {tmins}:{tsecs:02d}`\n*{footer_text}*"
        
        section = discord.ui.Section(
            discord.ui.TextDisplay(f"🎤 Karaoke: {self.song} by {self.artist}"),
            discord.ui.TextDisplay(desc),
            accessory=discord.ui.Thumbnail("https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif")
        )
        
        row1 = discord.ui.ActionRow(self.btn_rewind, self.btn_rewind_small, self.btn_forward_small, self.btn_forward)
        row2 = discord.ui.ActionRow(self.btn_play_pause, self.btn_stop)
        
        container = discord.ui.Container(section, row1, row2, accent_color=Theme.PRIMARY)
        self.add_item(container)

    async def _on_play_pause(self, interaction: discord.Interaction):
        self.is_playing = not self.is_playing
        
        if self.is_playing:
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()
            self.update_task = asyncio.create_task(self._update_loop())
            
        await interaction.response.defer()
        await self._edit_message()

    async def _on_rewind(self, interaction: discord.Interaction):
        self.current_time = max(0.0, self.current_time - 10.0)
        await interaction.response.defer()
        await self._edit_message()

    async def _on_rewind_small(self, interaction: discord.Interaction):
        self.current_time = max(0.0, self.current_time - 2.0)
        await interaction.response.defer()
        await self._edit_message()

    async def _on_forward_small(self, interaction: discord.Interaction):
        self.current_time = min(self.duration, self.current_time + 2.0)
        await interaction.response.defer()
        await self._edit_message()

    async def _on_forward(self, interaction: discord.Interaction):
        self.current_time = min(self.duration, self.current_time + 10.0)
        await interaction.response.defer()
        await self._edit_message()

    async def _on_stop(self, interaction: discord.Interaction):
        self.is_playing = False
        self.lines = [] # Force plain text mode
        self._build_layout()
        await interaction.response.edit_message(embeds=[], view=self)

    async def on_timeout(self):
        self.is_playing = False
        if self.message:
            try:
                self.btn_rewind.disabled = True
                self.btn_rewind_small.disabled = True
                self.btn_forward_small.disabled = True
                self.btn_forward.disabled = True
                self.btn_play_pause.disabled = True
                self.btn_stop.disabled = True
                self._build_layout()
                await self.message.edit(view=self)
            except:
                pass
