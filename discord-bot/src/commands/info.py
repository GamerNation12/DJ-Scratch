import discord
from discord.ext import commands
from discord import app_commands
import psutil
import time
from datetime import datetime, timedelta
from src.core.theme import Theme

from src.core.database import format_name


class InfoCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.process = psutil.Process()

    @app_commands.command(name="status", description="Displays bot's live stats, uptime, and performance metrics")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        
        # Ping
        ping = round(self.bot.latency * 1000)
        
        # Uptime
        uptime_seconds = int(time.time() - self.process.create_time())
        uptime_str = str(timedelta(seconds=uptime_seconds))
        
        # CPU and Memory
        cpu_usage = self.process.cpu_percent()
        ram_usage_mb = self.process.memory_info().rss / 1024 / 1024
        
        # Servers and Users
        server_count = len(self.bot.guilds)
        total_members = sum(g.member_count for g in self.bot.guilds if g.member_count)
        
        embed = discord.Embed(title="🤖 Bot Status", color=Theme.PRIMARY, timestamp=datetime.utcnow())
        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        
        embed.add_field(name="🟢 Uptime", value=f"`{uptime_str}`", inline=True)
        embed.add_field(name="🏓 Ping", value=f"`{ping}ms`", inline=True)
        embed.add_field(name="🌐 Servers", value=f"`{server_count:,}`", inline=True)
        
        embed.add_field(name="👥 Users", value=f"`{total_members:,}`", inline=True)
        embed.add_field(name="💻 CPU Usage", value=f"`{cpu_usage}%`", inline=True)
        embed.add_field(name="💾 RAM Usage", value=f"`{ram_usage_mb:.1f} MB`", inline=True)
        
        embed.set_footer(text="Powered by fps.ms Pterodactyl hosting")
        
        await interaction.followup.send(embed=embed)

    async def send_updates(self, context):
        from src.core.database import get_global_update_version, get_global_update_message
        
        embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - Latest Updates", color=Theme.PRIMARY, timestamp=discord.utils.utcnow())
        
        try:
            version = await get_global_update_version()
            message = await get_global_update_message()
            
            if version and message:
                embed.add_field(name=f"Update {version}", value=message, inline=False)
            else:
                embed.description = "No recent updates found."
        except Exception as e:
            embed.description = f"❌ Error fetching updates: {e}"

        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        embed.set_footer(text=Theme.FOOTER_TEXT)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="updates", description="Displays the latest bot updates and features")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def updates_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_updates(interaction)

    @commands.command(name="updates", aliases=["changelog", "news", "up", "u"])
    async def updates_prefix(self, ctx):
        await self.send_updates(ctx)

    async def send_outofsync(self, context):
        embed = discord.Embed(title="Spotify & Last.fm Sync Issue", color=Theme.PRIMARY)
        embed.description = (
            "Spotify recently changed their API rules. You now have to re-authenticate Last.fm (and other Spotify apps) **every six months**, otherwise your scrobbles will stop.\n\n"
            "**How to fix:**\n"
            "1. Go to your [Last.fm Application Settings](https://www.last.fm/settings/applications)\n"
            "2. Find **Spotify Scrobbling** and click **Reconnect**.\n\n"
            "You'll need to do this every six months to keep your scrobbles syncing!"
        )
        embed.set_thumbnail(url=self.bot.user.display_avatar.url)
        embed.set_footer(text=Theme.FOOTER_TEXT)
        
        if isinstance(context, discord.Interaction):
            await context.followup.send(embed=embed)
        else:
            await context.send(embed=embed)

    @app_commands.command(name="outofsync", description="Fix missing Spotify scrobbles on Last.fm")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def outofsync_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        await self.send_outofsync(interaction)

    @commands.command(name="outofsync", aliases=["sync", "spotifyauth", "missing"])
    async def outofsync_prefix(self, ctx):
        await self.send_outofsync(ctx)

async def setup(bot):
    await bot.add_cog(InfoCog(bot))
