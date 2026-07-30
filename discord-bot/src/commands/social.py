import discord
from discord.ext import commands
from discord import app_commands
from src.core.database import add_friend_request, accept_friend_request, remove_friend, get_friends, send_dm, get_user_by_name

class SocialCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    social_group = app_commands.Group(name="social", description="Friends and Direct Messages")

    @social_group.command(name="addfriend", description="Send a friend request")
    @app_commands.describe(user="The Discord user to add as a friend")
    async def add_friend(self, interaction: discord.Interaction, user: discord.User):
        await interaction.response.defer(ephemeral=True)
        user_id = str(interaction.user.id)
        
        friend_id = str(user.id)
            
        if user_id == friend_id:
            embed = discord.Embed(color=0xFF0000, description="❌ You cannot add yourself!")
            await interaction.followup.send(embed=embed)
            return
            
        status = await add_friend_request(
            user_id, friend_id, 
            friend_username=user.name, user_username=interaction.user.name,
            friend_avatar=user.avatar.url if user.avatar else (user.default_avatar.url if user.default_avatar else None),
            user_avatar=interaction.user.avatar.url if interaction.user.avatar else (interaction.user.default_avatar.url if interaction.user.default_avatar else None)
        )
        if status == 'accepted':
            embed = discord.Embed(color=0x00FF00, description=f"✅ You are now friends with **{user.display_name}**!")
            if user.avatar: embed.set_thumbnail(url=user.avatar.url)
            await interaction.followup.send(embed=embed)
            try:
                dm_embed = discord.Embed(color=0x00FF00, description=f"✅ **{interaction.user.display_name}** accepted your friend request on DJ Scratch!")
                if interaction.user.avatar: dm_embed.set_thumbnail(url=interaction.user.avatar.url)
                await user.send(embed=dm_embed)
            except:
                pass
        elif status == 'pending':
            embed = discord.Embed(color=0x00AAFF, description=f"📩 Friend request sent to **{user.display_name}**!")
            if user.avatar: embed.set_thumbnail(url=user.avatar.url)
            await interaction.followup.send(embed=embed)
            try:
                dm_embed = discord.Embed(color=0x00AAFF, description=f"📩 **{interaction.user.display_name}** sent you a friend request on DJ Scratch! View it on the website or app.")
                if interaction.user.avatar: dm_embed.set_thumbnail(url=interaction.user.avatar.url)
                await user.send(embed=dm_embed)
            except:
                pass
        elif status == 'already_friends':
            embed = discord.Embed(color=0xFFA500, description=f"⚠️ You are already friends with **{user.display_name}**.")
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(color=0xFF0000, description="❌ Failed to send request.")
            await interaction.followup.send(embed=embed)

    @social_group.command(name="accept", description="Accept a friend request")
    @app_commands.describe(user="The Discord user whose request you want to accept")
    async def accept_friend(self, interaction: discord.Interaction, user: discord.User):
        await interaction.response.defer(ephemeral=True)
        user_id = str(interaction.user.id)
        
        friend_id = str(user.id)
            
        success = await accept_friend_request(
            user_id, friend_id, 
            friend_username=user.name, user_username=interaction.user.name,
            friend_avatar=user.avatar.url if user.avatar else (user.default_avatar.url if user.default_avatar else None),
            user_avatar=interaction.user.avatar.url if interaction.user.avatar else (interaction.user.default_avatar.url if interaction.user.default_avatar else None)
        )
        if success:
            embed = discord.Embed(color=0x00FF00, description=f"✅ Accepted friend request from **{user.display_name}**!")
            if user.avatar: embed.set_thumbnail(url=user.avatar.url)
            await interaction.followup.send(embed=embed)
            try:
                dm_embed = discord.Embed(color=0x00FF00, description=f"✅ **{interaction.user.display_name}** accepted your friend request on DJ Scratch!")
                if interaction.user.avatar: dm_embed.set_thumbnail(url=interaction.user.avatar.url)
                await user.send(embed=dm_embed)
            except:
                pass
        else:
            embed = discord.Embed(color=0xFF0000, description="❌ Failed to accept request (make sure they sent one first).")
            await interaction.followup.send(embed=embed)

    @app_commands.command(name="dms", description="Open your DJ Scratch Direct Messages")
    async def open_dms(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="💬 DJ Scratch DMs",
            description="We've upgraded our messaging system to a full Discord Activity!\n\n**To open your DMs on any platform:**\n1. Click the **App Launcher** (rocket ship icon 🚀 or '+' button) next to the chat bar.\n2. Select **DJ Scratch**.\n3. Chat with your friends in a custom full-screen UI!",
            color=discord.Color.blurple()
        )
        
        view = discord.ui.View()
        btn = discord.ui.Button(label="Open Web Dashboard", style=discord.ButtonStyle.link, url="https://the-goats-dj.vercel.app/messages")
        view.add_item(btn)
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

async def setup(bot):
    await bot.add_cog(SocialCog(bot))
