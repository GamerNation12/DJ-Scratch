import discord
import asyncio
import re
from src.core.theme import Theme

def parse_synced_lyrics(synced_text: str):
    """
    Parses synced lyrics into a list of (timestamp_seconds, text).
    """
    lines = []
    for line in synced_text.split('\n'):
        match = re.match(r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)', line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            millis = int(match.group(3))
            
            # Convert to seconds
            if len(match.group(3)) == 2:
                total_seconds = minutes * 60 + seconds + (millis / 100.0)
            else:
                total_seconds = minutes * 60 + seconds + (millis / 1000.0)
                
            text = match.group(4).strip()
            lines.append((total_seconds, text))
    return lines

class KaraokeLyricsView(discord.ui.View):
    def __init__(self, artist: str, song: str, synced_lyrics: str, plain_lyrics: str):
        super().__init__(timeout=300) # 5 minutes timeout
        self.artist = artist
        self.song = song
        self.plain_lyrics = plain_lyrics
        self.lines = parse_synced_lyrics(synced_lyrics) if synced_lyrics else []
        
        self.is_playing = False
        self.current_time = 0.0
        self.message: discord.Message = None
        self.update_task = None
        
        # Get total duration from the last lyric line if possible
        self.duration = self.lines[-1][0] + 10.0 if self.lines else 180.0
        
        # If no synced lyrics, disable karaoke controls
        if not self.lines:
            for child in self.children:
                child.disabled = True

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
            
        embed = self._build_embed()
        
        # Update button styles
        for child in self.children:
            if child.custom_id == "play_pause":
                child.label = "Pause" if self.is_playing else "Play"
                child.emoji = "⏸️" if self.is_playing else "▶️"
                child.style = discord.ButtonStyle.success if self.is_playing else discord.ButtonStyle.primary
                
        try:
            await self.message.edit(embed=embed, view=self)
        except Exception:
            self.is_playing = False

    def _build_embed(self) -> discord.Embed:
        if not self.lines:
            desc = self.plain_lyrics or "No lyrics available."
            if len(desc) > 4096:
                desc = desc[:4093] + "..."
            return Theme.get_embed(title=f"Lyrics for {self.song} by {self.artist}", description=desc, color=Theme.PRIMARY)
            
        # Find current active line index
        active_idx = 0
        for i, (ts, text) in enumerate(self.lines):
            if ts <= self.current_time:
                active_idx = i
            else:
                break
                
        # Build scrolling text
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
        
        # Progress bar
        pct = min(1.0, self.current_time / self.duration)
        bar_len = 15
        filled = int(pct * bar_len)
        bar = "▬" * filled + "🔘" + "▬" * (bar_len - filled)
        
        mins, secs = divmod(int(self.current_time), 60)
        tmins, tsecs = divmod(int(self.duration), 60)
        
        desc += f"\n\n`{mins}:{secs:02d} {bar} {tmins}:{tsecs:02d}`"
        
        embed = Theme.get_embed(title=f"🎤 Karaoke: {self.song} by {self.artist}", description=desc, color=Theme.PRIMARY)
        if self.is_playing:
            embed.set_footer(text="Auto-syncing lyrics... (Updates every 2s)")
        else:
            embed.set_footer(text="Paused. Use buttons to sync.")
            
        return embed

    @discord.ui.button(label="Play", emoji="▶️", style=discord.ButtonStyle.primary, custom_id="play_pause")
    async def btn_play_pause(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.is_playing = not self.is_playing
        
        if self.is_playing:
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()
            self.update_task = asyncio.create_task(self._update_loop())
            
        await interaction.response.defer()
        await self._edit_message()

    @discord.ui.button(label="-10s", emoji="⏪", style=discord.ButtonStyle.secondary, custom_id="rewind")
    async def btn_rewind(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_time = max(0.0, self.current_time - 10.0)
        await interaction.response.defer()
        await self._edit_message()

    @discord.ui.button(label="+10s", emoji="⏩", style=discord.ButtonStyle.secondary, custom_id="forward")
    async def btn_forward(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_time = min(self.duration, self.current_time + 10.0)
        await interaction.response.defer()
        await self._edit_message()

    @discord.ui.button(label="Plain Text", emoji="⏹️", style=discord.ButtonStyle.danger, custom_id="stop")
    async def btn_stop(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.is_playing = False
        
        desc = self.plain_lyrics or "No lyrics available."
        if len(desc) > 4096:
            desc = desc[:4093] + "..."
            
        embed = Theme.get_embed(title=f"Lyrics for {self.song} by {self.artist}", description=desc, color=Theme.PRIMARY)
        
        # Remove buttons
        self.clear_items()
        await interaction.response.edit_message(embed=embed, view=self)

    async def on_timeout(self):
        self.is_playing = False
        if self.message:
            try:
                for child in self.children:
                    child.disabled = True
                await self.message.edit(view=self)
            except:
                pass
