import discord
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

class DummyBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)

    async def on_ready(self):
        print(f"Logged in as {self.user} (Dummy Mode)")
        await self.change_presence(
            status=discord.Status.dnd,
            activity=discord.Game(name="DJ Scratch is offline ⚠️")
        )
        try:
            owner = await self.fetch_user(217874027543265280)
            await owner.send("🚨 **CRITICAL ALERT:** The main DJ Scratch bot has crashed or gone offline! The fallback Dummy Bot has now taken over.")
        except Exception as e:
            print(f"Could not DM owner: {e}")

    async def on_interaction(self, interaction: discord.Interaction):
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
        if message.author.bot:
            return
            
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
