import discord
from discord.ext import commands
from discord import app_commands

class TestFeatures(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="hello_test", description="A test command that only exists on the test bot!")
    async def hello_test(self, interaction: discord.Interaction):
        await interaction.response.send_message("👋 Hello from the test bot's exclusive features folder!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(TestFeatures(bot))
