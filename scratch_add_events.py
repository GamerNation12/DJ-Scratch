with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/events.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_prefix = """
@bot.check
async def global_disabled_command_check_prefix(ctx) -> bool:
    if not ctx.command: return True
    from src.core.database import is_command_disabled
    reason = await is_command_disabled(ctx.command.name)
    if reason:
        embed = Theme.get_embed(
            title="🔒 Command Locked",
            description=f"This command has been disabled by an administrator.\\n\\n**Reason:** {reason}",
            color=discord.Color.red()
        )
        try:
            await ctx.send(embed=embed)
        except:
            pass
        return False
    return True
"""

new_slash = """
@bot.tree.interaction_check
async def global_disabled_command_check_slash(interaction: discord.Interaction) -> bool:
    if interaction.type != discord.InteractionType.application_command:
        return True
    if not interaction.command: return True
    
    from src.core.database import is_command_disabled
    reason = await is_command_disabled(interaction.command.name)
    if reason:
        embed = Theme.get_embed(
            title="🔒 Command Locked",
            description=f"This command has been disabled by an administrator.\\n\\n**Reason:** {reason}",
            color=discord.Color.red()
        )
        try:
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except:
            pass
        return False
    return True
"""

if 'global_disabled_command_check_prefix' not in text:
    text = text.replace('@bot.check\nasync def global_login_check_prefix(ctx) -> bool:', new_prefix + '\n@bot.check\nasync def global_login_check_prefix(ctx) -> bool:')

if 'global_disabled_command_check_slash' not in text:
    text = text.replace('@bot.tree.interaction_check\nasync def check_if_logged_in(interaction: discord.Interaction) -> bool:', new_slash + '\n@bot.tree.interaction_check\nasync def check_if_logged_in(interaction: discord.Interaction) -> bool:')

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/discord-bot/src/core/events.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Added global command disabled checks to events.py')
