import os
os.system("pip install PyNaCl")
from src.core.events import bot
from dotenv import load_dotenv
import colorama

load_dotenv()
if __name__ == "__main__":
    colorama.init()
    print("Starting the Goats DJ Bot...")
    bot.run(os.getenv("DISCORD_TOKEN"))
