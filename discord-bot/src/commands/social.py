import discord
from discord.ext import commands
from discord import app_commands
from src.core.database import add_friend_request, accept_friend_request, remove_friend, get_friends, send_dm, get_user_by_name
from src.core.ui import create_error_layout, create_success_layout, create_info_layout, create_simple_layout

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
            view = create_error_layout("❌ You cannot add yourself!")
            await interaction.followup.send(view=view)
            return
            
        status = await add_friend_request(
            user_id, friend_id, 
            friend_username=user.name, user_username=interaction.user.name,
            friend_avatar=user.avatar.url if user.avatar else (user.default_avatar.url if user.default_avatar else None),
            user_avatar=interaction.user.avatar.url if interaction.user.avatar else (interaction.user.default_avatar.url if interaction.user.default_avatar else None)
        )
        if status == 'accepted':
            view = create_success_layout(f"✅ You are now friends with **{user.display_name}**!", thumbnail_url=user.avatar.url if user.avatar else None)
            await interaction.followup.send(view=view)
            try:
                dm_view = create_success_layout(f"✅ **{interaction.user.display_name}** accepted your friend request on DJ Scratch!", thumbnail_url=interaction.user.avatar.url if interaction.user.avatar else None)
                await user.send(view=dm_view)
            except:
                pass
        elif status == 'pending':
            view = create_info_layout(f"📩 Friend request sent to **{user.display_name}**!", thumbnail_url=user.avatar.url if user.avatar else None)
            await interaction.followup.send(view=view)
            try:
                dm_view = create_info_layout(f"📩 **{interaction.user.display_name}** sent you a friend request on DJ Scratch! View it on the website or app.", thumbnail_url=interaction.user.avatar.url if interaction.user.avatar else None)
                await user.send(view=dm_view)
            except:
                pass
        elif status == 'already_friends':
            view = create_simple_layout(f"⚠️ You are already friends with **{user.display_name}**.", color=discord.Color.orange())
            await interaction.followup.send(view=view)
        else:
            view = create_error_layout("❌ Failed to send request.")
            await interaction.followup.send(view=view)

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
            view = create_success_layout(f"✅ Accepted friend request from **{user.display_name}**!", thumbnail_url=user.avatar.url if user.avatar else None)
            await interaction.followup.send(view=view)
            try:
                dm_view = create_success_layout(f"✅ **{interaction.user.display_name}** accepted your friend request on DJ Scratch!", thumbnail_url=interaction.user.avatar.url if interaction.user.avatar else None)
                await user.send(view=dm_view)
            except:
                pass
        else:
            view = create_error_layout("❌ Failed to accept request (make sure they sent one first).")
            await interaction.followup.send(view=view)

    @app_commands.command(name="dms", description="Open your DJ Scratch Direct Messages")
    async def open_dms(self, interaction: discord.Interaction):
        desc = (
            "We've upgraded our messaging system to a full Discord Activity!\n\n"
            "**To open your DMs on any platform:**\n"
            "1. Click the **App Launcher** (rocket ship icon 🚀 or '+' button) next to the chat bar.\n"
            "2. Select **DJ Scratch**.\n"
            "3. Chat with your friends in a custom full-screen UI!"
        )
        view = create_simple_layout(desc, color=discord.Color.blurple(), title="💬 DJ Scratch DMs")
        
        btn = discord.ui.Button(label="Open Web Dashboard", style=discord.ButtonStyle.link, url="https://the-goats-dj.vercel.app/messages")
        
        # We need to manually add the button to the layout view
        # The view returned by create_simple_layout has the container. We can add an ActionRow.
        # Since it's returned as a LayoutView, we can reconstruct or just add a row to the container.
        # Let's rebuild the container with the row.
        
        layout_view = discord.ui.LayoutView()
        section = discord.ui.Section(
            discord.ui.TextDisplay("💬 DJ Scratch DMs"),
            discord.ui.TextDisplay(desc),
            accessory=None
        )
        row = discord.ui.ActionRow(btn)
        container = discord.ui.Container(section, row, accent_color=discord.Color.blurple())
        layout_view.add_item(container)
        
        await interaction.response.send_message(view=layout_view, ephemeral=True)

async def setup(bot):
    await bot.add_cog(SocialCog(bot))
