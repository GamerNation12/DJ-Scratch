import os
os.system("pip install PyNaCl")
from src.core.events import bot
from dotenv import load_dotenv

load_dotenv()
if __name__ == "__main__":
    print("Starting the Goats DJ Bot...")
    bot.run(os.getenv("DISCORD_TOKEN"))
