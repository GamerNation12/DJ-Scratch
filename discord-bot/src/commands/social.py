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
            await interaction.followup.send("You cannot add yourself!")
            return
            
        status = await add_friend_request(
            user_id, friend_id, 
            friend_username=user.name, user_username=interaction.user.name,
            friend_avatar=user.avatar.url if user.avatar else (user.default_avatar.url if user.default_avatar else None),
            user_avatar=interaction.user.avatar.url if interaction.user.avatar else (interaction.user.default_avatar.url if interaction.user.default_avatar else None)
        )
        if status == 'accepted':
            await interaction.followup.send(f"You are now friends with {user.display_name}!")
            try:
                await user.send(f"**{interaction.user.display_name}** accepted your friend request on DJ Scratch!")
            except:
                pass
        elif status == 'pending':
            await interaction.followup.send(f"Friend request sent to {user.display_name}!")
            try:
                await user.send(f"**{interaction.user.display_name}** sent you a friend request on DJ Scratch! View it on the website or app.")
            except:
                pass
        elif status == 'already_friends':
            await interaction.followup.send(f"You are already friends with {user.display_name}.")
        else:
            await interaction.followup.send("Failed to send request.")

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
            await interaction.followup.send(f"Accepted friend request from {user.display_name}!")
            try:
                await user.send(f"**{interaction.user.display_name}** accepted your friend request on DJ Scratch!")
            except:
                pass
        else:
            await interaction.followup.send("Failed to accept request (make sure they sent one first).")

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
