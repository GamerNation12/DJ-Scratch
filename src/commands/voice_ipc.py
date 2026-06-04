import discord
from discord.ext import commands, tasks
import asyncio
import os
import base64
import tempfile
from src.core.events import db_pool, Log

class VoiceIPC(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.check_voice_queue.start()
        self.current_vc = None

    def cog_unload(self):
        self.check_voice_queue.cancel()

    @tasks.loop(seconds=1)
    async def check_voice_queue(self):
        if not db_pool:
            return
            
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT id, channel_id, audio_base64 FROM voice_transmissions WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1"
                )
                if row:
                    print(f"{Log.CYAN}>>> [VOICE IPC] Found pending voice transmission for channel {row['channel_id']}{Log.RESET}")
                    
                    # Mark as processing
                    await conn.execute("UPDATE voice_transmissions SET status = 'PROCESSING' WHERE id = $1", row['id'])
                    
                    try:
                        channel = self.bot.get_channel(int(row['channel_id']))
                        if not channel:
                            channel = await self.bot.fetch_channel(int(row['channel_id']))
                            
                        if not channel or not isinstance(channel, discord.VoiceChannel):
                            print(f"{Log.RED}>>> [VOICE IPC] Invalid or inaccessible voice channel: {row['channel_id']}{Log.RESET}")
                            await conn.execute("UPDATE voice_transmissions SET status = 'FAILED' WHERE id = $1", row['id'])
                            return

                        # Connect to VC if not already connected to THIS channel
                        if not self.current_vc or not self.current_vc.is_connected():
                            self.current_vc = await channel.connect()
                        elif self.current_vc.channel.id != channel.id:
                            await self.current_vc.move_to(channel)

                        # Write Base64 to temp file
                        audio_data = base64.b64decode(row['audio_base64'])
                        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.webm')
                        temp_file.write(audio_data)
                        temp_file.close()

                        # Stop current audio if playing
                        if self.current_vc.is_playing():
                            self.current_vc.stop()

                        # Play audio
                        source = discord.FFmpegPCMAudio(temp_file.name)
                        
                        def after_play(err):
                            if err:
                                print(f"{Log.RED}>>> [VOICE IPC] FFmpeg error: {err}{Log.RESET}")
                            try:
                                os.remove(temp_file.name)
                            except:
                                pass

                        self.current_vc.play(source, after=after_play)

                        # Mark as completed
                        await conn.execute("UPDATE voice_transmissions SET status = 'COMPLETED' WHERE id = $1", row['id'])
                        print(f"{Log.GREEN}>>> [VOICE IPC] Voice transmission playing successfully.{Log.RESET}")

                        # Delete the row to save space (since base64 is huge)
                        await conn.execute("DELETE FROM voice_transmissions WHERE id = $1", row['id'])

                    except Exception as e:
                        print(f"{Log.RED}>>> [VOICE IPC] Error processing voice: {e}{Log.RESET}")
                        await conn.execute("UPDATE voice_transmissions SET status = 'FAILED' WHERE id = $1", row['id'])

        except Exception as e:
            print(f"{Log.RED}>>> [VOICE IPC] Error checking DB: {e}{Log.RESET}")

    @check_voice_queue.before_loop
    async def before_check(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(VoiceIPC(bot))
