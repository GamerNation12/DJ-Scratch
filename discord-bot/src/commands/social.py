import discord
from discord.ext import commands
from discord import app_commands
from src.core.database import add_friend_request, accept_friend_request, remove_friend, get_friends, send_dm, get_user_by_name

class SocialCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    social_group = app_commands.Group(name="social", description="Friends and Direct Messages")

    @social_group.command(name="addfriend", description="Send a friend request")
    @app_commands.describe(user="The user to add")
    async def add_friend(self, interaction: discord.Interaction, user: discord.Member):
        await interaction.response.defer(ephemeral=True)
        user_id = str(interaction.user.id)
        friend_id = str(user.id)
        
        if user_id == friend_id:
            await interaction.followup.send("You cannot add yourself!")
            return
            
        status = await add_friend_request(user_id, friend_id)
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
    @app_commands.describe(user="The user to accept")
    async def accept_friend(self, interaction: discord.Interaction, user: discord.Member):
        await interaction.response.defer(ephemeral=True)
        user_id = str(interaction.user.id)
        friend_id = str(user.id)
        
        success = await accept_friend_request(user_id, friend_id)
        if success:
            await interaction.followup.send(f"Accepted friend request from {user.display_name}!")
            try:
                await user.send(f"**{interaction.user.display_name}** accepted your friend request on DJ Scratch!")
            except:
                pass
        else:
            await interaction.followup.send("Failed to accept request (make sure they sent one first).")

    @social_group.command(name="dm", description="Send a direct message on the app")
    @app_commands.describe(user="The user to message", message="The message content")
    async def send_app_dm(self, interaction: discord.Interaction, user: discord.Member, message: str):
        await interaction.response.defer(ephemeral=True)
        sender_id = str(interaction.user.id)
        receiver_id = str(user.id)
        
        # Check if they are friends
        friends_list = await get_friends(sender_id)
        is_friend = any(f['id'] == receiver_id and f['status'] == 'accepted' for f in friends_list)
        
        if not is_friend:
            await interaction.followup.send("You can only send DMs to friends!")
            return
            
        success = await send_dm(sender_id, receiver_id, message)
        if success:
            await interaction.followup.send("Message sent!")
            try:
                await user.send(f"New DM from **{interaction.user.display_name}** on DJ Scratch:\n`{message}`\n*(Reply on the website/app)*")
            except:
                pass
        else:
            await interaction.followup.send("Failed to send message.")

    @app_commands.command(name="reply", description="Send a direct message reply to a user on the app")
    @app_commands.describe(user="The user to message", message="The message content")
    async def reply_dm(self, interaction: discord.Interaction, user: discord.Member, message: str):
        await interaction.response.defer(ephemeral=True)
        sender_id = str(interaction.user.id)
        receiver_id = str(user.id)
        
        # Check if they are friends
        friends_list = await get_friends(sender_id)
        is_friend = any(f['id'] == receiver_id and f['status'] == 'accepted' for f in friends_list)
        
        if not is_friend:
            await interaction.followup.send("You can only send DMs to friends!")
            return
            
        success = await send_dm(sender_id, receiver_id, message)
        if success:
            await interaction.followup.send(f"Reply sent to {user.display_name}!")
            try:
                view = discord.ui.View()
                btn = discord.ui.Button(label="Reply via Discord", style=discord.ButtonStyle.primary, custom_id=f"reply_dm_{sender_id}")
                view.add_item(btn)
                await user.send(f"New DM from **{interaction.user.display_name}** on DJ Scratch:\n`{message}`\n*(Reply on the website/app or click below)*", view=view)
            except:
                pass
        else:
            await interaction.followup.send("Failed to send message.")

async def setup(bot):
    await bot.add_cog(SocialCog(bot))
