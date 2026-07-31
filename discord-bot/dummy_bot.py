import discord
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

class DummyBot(discord.Client):
    def __init__(self):
        super().__init__(intents=discord.Intents.default())

    async def on_ready(self):
        print(f"Logged in as {self.user} (Dummy Mode)")
        await self.change_presence(
            status=discord.Status.dnd,
            activity=discord.Game(name="Host is offline ⚠️")
        )

    async def on_interaction(self, interaction: discord.Interaction):
        if interaction.type == discord.InteractionType.application_command:
            try:
                await interaction.response.send_message(
                    "⚠️ **DJ Scratch is currently down!**\\n"
                    "Our hosting provider is experiencing an outage. Commands will not work until the server is back online. Thanks for your patience!",
                    ephemeral=True
                )
            except Exception as e:
                print(f"Failed to reply to interaction: {e}")

if __name__ == "__main__":
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        print("No DISCORD_TOKEN found in .env")
        exit(1)
    
    bot = DummyBot()
    bot.run(token)
