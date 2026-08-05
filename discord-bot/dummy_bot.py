import discord
import os
import sys
import psycopg2
import json
from datetime import datetime, timedelta
from discord.ext import tasks
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

class DummyBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.is_active = False
        self.db_url = os.getenv("DATABASE_URL")

    async def setup_hook(self):
        self.watchdog_task.start()

    async def on_ready(self):
        print(f"Logged in as {self.user} (Smart Watchdog Mode)")
        await self.change_presence(
            status=discord.Status.invisible
        )

    @tasks.loop(seconds=30)
    async def watchdog_task(self):
        if not self.db_url:
            return
            
        try:
            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            
            # Check heartbeat
            cur.execute("SELECT value FROM global_settings WHERE key = 'last_heartbeat'")
            row = cur.fetchone()
            
            if not row:
                cur.close()
                conn.close()
                return
                
            last_heartbeat_str = row[0].replace('Z', '')
            last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
            
            # If heartbeat is older than 3 minutes, bot is offline!
            if datetime.utcnow() - last_heartbeat > timedelta(minutes=3):
                if not self.is_active:
                    print("MAIN BOT IS OFFLINE! Activating Dummy Mode...")
                    self.is_active = True
                    await self.change_presence(
                        status=discord.Status.dnd,
                        activity=discord.Game(name="DJ Scratch is offline ⚠️")
                    )
                    
                    try:
                        owner = await self.fetch_user(759433582107426816)
                        await owner.send("🚨 **CRITICAL ALERT:** The main DJ Scratch bot has crashed or gone offline! The Smart Watchdog has taken over.")
                    except Exception:
                        pass
                        
                    # Update status messages
                    cur.execute("SELECT value FROM global_settings WHERE key = 'status_messages'")
                    messages_row = cur.fetchone()
                    if messages_row and messages_row[0]:
                        try:
                            messages = json.loads(messages_row[0])
                            embed = discord.Embed(
                                title="<a:VinylRecord:1527125818713837701> DJ Scratch - System Status",
                                description="**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server.*",
                                color=0xFF0000,
                                timestamp=discord.utils.utcnow()
                            )
                            embed.set_footer(text="Watchdog Monitor")
                            
                            for item in messages:
                                channel_id = item.get("channel_id")
                                message_id = item.get("message_id")
                                if channel_id and message_id:
                                    try:
                                        channel = await self.fetch_channel(channel_id)
                                        msg = await channel.fetch_message(message_id)
                                        await msg.edit(embed=embed)
                                    except Exception as e:
                                        print(f"Failed to edit status message {message_id}: {e}")
                        except Exception as e:
                            print(f"Failed to parse status_messages: {e}")
                            
            else:
                if self.is_active:
                    print("Main bot is back online! Deactivating Dummy Mode...")
                    self.is_active = False
                    await self.change_presence(status=discord.Status.invisible)
                    
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Watchdog database error: {e}")

    @watchdog_task.before_loop
    async def before_watchdog(self):
        await self.wait_until_ready()

    async def on_interaction(self, interaction: discord.Interaction):
        if not self.is_active: return
        
        if interaction.type == discord.InteractionType.application_command:
            try:
                embed = discord.Embed(
                    title="⚠️ DJ Scratch is currently down!",
                    description="Our hosting provider is experiencing an outage or the bot has crashed. Commands will not work until the server is back online. Thanks for your patience!",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
            except Exception as e:
                print(f"Failed to reply to interaction: {e}")

    async def on_message(self, message: discord.Message):
        if not self.is_active: return
        if message.author.bot: return
            
        if message.content.startswith(","):
            try:
                embed = discord.Embed(
                    title="⚠️ DJ Scratch is currently down!",
                    description="Our hosting provider is experiencing an outage or the bot has crashed. Commands will not work until the server is back online. Thanks for your patience!",
                    color=discord.Color.red()
                )
                await message.reply(embed=embed)
            except Exception:
                pass

if __name__ == "__main__":
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        print("No DISCORD_TOKEN found in .env")
        exit(1)
    
    bot = DummyBot()
    bot.run(token)
