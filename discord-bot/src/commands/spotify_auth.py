import discord
from discord.ext import commands
from discord import app_commands
from src.core.theme import Theme

class SpotifyAuth(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    spotify_group = app_commands.Group(name="spotify", description="Manage your Spotify connection")

    @spotify_group.command(name="login", description="Link your Spotify account for perfect Karaoke auto-syncing!")
    async def spotify_login(self, interaction: discord.Interaction):
        # We point them to the Next.js API route!
        auth_url = f"https://dj-scratch.vercel.app/api/auth/spotify/login?discord_id={interaction.user.id}"
        
        embed = Theme.get_embed(
            title="🎵 Link Your Spotify",
            description="Connecting your Spotify account allows DJ Scratch to perfectly auto-sync Karaoke lyrics with the exact millisecond you are listening to!\n\nClick the button below to log in securely via the DJ Scratch website.",
            color=discord.Color.green()
        )
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Connect to Spotify", url=auth_url, style=discord.ButtonStyle.link))
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

    @spotify_group.command(name="logout", description="Unlink your Spotify account from DJ Scratch")
    async def spotify_logout(self, interaction: discord.Interaction):
        from src.core.database import db_pool
        if not db_pool:
            await interaction.response.send_message("Database connection error.", ephemeral=True)
            return
            
        async with db_pool.acquire() as conn:
            await conn.execute('''
                UPDATE user_settings 
                SET spotify_access_token = NULL, 
                    spotify_refresh_token = NULL, 
                    spotify_token_expires_at = NULL 
                WHERE user_id = $1
            ''', str(interaction.user.id))
            
        embed = Theme.get_embed(
            title="🔓 Spotify Unlinked",
            description="Your Spotify account has been disconnected from DJ Scratch.",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(SpotifyAuth(bot))
