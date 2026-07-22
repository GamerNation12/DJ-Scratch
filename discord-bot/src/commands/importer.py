import discord
from discord.ext import commands
from discord import app_commands

from src.core.database import format_name


class ImporterCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="import", description="Upload your Spotify/Apple Music extended history ZIP or CSV")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def import_slash(self, interaction: discord.Interaction, file: discord.Attachment):
        if not (file.filename.endswith('.zip') or file.filename.endswith('.csv')):
            await interaction.response.send_message("❌ Please upload a valid .zip or .csv file containing your Spotify or Apple Music extended streaming history.", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await self.bot.handle_discord_import(interaction.user, file, interaction.followup.send)

    @commands.command(name="import", aliases=["imp", "i"])
    async def import_prefix(self, ctx):
        if not ctx.message.attachments:
            await ctx.send("❌ Please attach your Spotify/Apple Music extended history .zip or .csv file to the message.")
            return
        attachment = ctx.message.attachments[0]
        if not (attachment.filename.endswith('.zip') or attachment.filename.endswith('.csv')):
            await ctx.send("❌ The attachment must be a .zip or .csv file.")
            return
        await self.bot.handle_discord_import(ctx.author, attachment, ctx.send)

    @app_commands.command(name="deletedata", description="Delete all your imported data from the database")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def delete_data_slash(self, interaction: discord.Interaction):
        view = self.bot.PurgeConfirmView(interaction.user)
        await interaction.response.send_message(
            "⚠️ **WARNING:** This will delete all your imported Spotify history from the bot's database.\\n\\nAre you absolutely sure you want to proceed?", 
            view=view, ephemeral=True
        )

    @commands.command(name="deletedata", aliases=["purgedata", "resetdata", "dd", "pd"])
    async def delete_data_prefix(self, ctx):
        view = self.bot.PurgeConfirmView(ctx.author)
        await ctx.send(
            "⚠️ **WARNING:** This will delete all your imported Spotify history from the bot's database.\\n\\nAre you absolutely sure you want to proceed?", 
            view=view
        )

async def setup(bot):
    await bot.add_cog(ImporterCog(bot))
