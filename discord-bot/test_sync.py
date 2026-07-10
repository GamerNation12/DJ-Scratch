import asyncio
import discord
from discord.ext import commands
from src.core.config import BOT_TOKEN

bot = commands.Bot(command_prefix=",", intents=discord.Intents.default())

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    try:
        app_info = await bot.application_info()
        app_id = app_info.id
        
        # get existing commands
        existing = await bot.http.get_global_commands(app_id)
        print("Existing:", [(c['name'], c['type']) for c in existing])
        
        # build payload for tree
        payload = []
        for cmd in bot.tree.get_commands():
            # wait, get_commands() doesn't have a to_dict() that is public
            pass
            
        # but wait, can we just do:
        # tree.sync() uses bot.tree._get_all_commands() and then cmd.to_dict()
        # let's try to access it
        local_cmds = bot.tree._get_all_commands(guild=None)
        payload = [c.to_dict() for c in local_cmds]
        
        for e_cmd in existing:
            if e_cmd.get('type') == 4:
                print("Found entry point:", e_cmd['name'])
                payload.append(e_cmd)
                
        print("New Payload:", [c.get('name') for c in payload])
    except Exception as e:
        print("Error:", e)
    await bot.close()

bot.run(BOT_TOKEN)
