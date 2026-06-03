import discord
from discord.ext import commands
from discord import app_commands

class ImporterCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="import", description="Upload your Spotify extended history ZIP")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def import_slash(self, interaction: discord.Interaction, zip_file: discord.Attachment):
        if not zip_file.filename.endswith('.zip'):
            await interaction.response.send_message("❌ Please upload a valid .zip file containing your Spotify extended streaming history.", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await self.bot.handle_discord_import(interaction, zip_file)

    @commands.command(name="import")
    async def import_prefix(self, ctx):
        if not ctx.message.attachments:
            await ctx.send("❌ Please attach your Spotify extended history .zip file to the message.")
            return
        attachment = ctx.message.attachments[0]
        if not attachment.filename.endswith('.zip'):
            await ctx.send("❌ The attachment must be a .zip file.")
            return
        await self.bot.handle_discord_import(ctx, attachment)

    @app_commands.command(name="deletedata", description="Delete all your imported data from the database")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def delete_data_slash(self, interaction: discord.Interaction):
        view = self.bot.PurgeConfirmView(self.bot, interaction.user.id)
        await interaction.response.send_message(
            "⚠️ **WARNING:** This will delete all your imported Spotify history from the bot's database, AND unlink your Last.fm account.\\n\\nAre you absolutely sure you want to proceed?", 
            view=view, ephemeral=True
        )

    @commands.command(name="deletedata", aliases=["purgedata", "resetdata"])
    async def delete_data_prefix(self, ctx):
        view = self.bot.PurgeConfirmView(self.bot, ctx.author.id)
        await ctx.send(
            "⚠️ **WARNING:** This will delete all your imported Spotify history from the bot's database, AND unlink your Last.fm account.\\n\\nAre you absolutely sure you want to proceed?", 
            view=view
        )

async def setup(bot):
    await bot.add_cog(ImporterCog(bot))
