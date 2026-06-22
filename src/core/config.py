import os
from dotenv import load_dotenv

load_dotenv()

class Log:
    RESET = '\033[0m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'

OWNER_ID = 759433582107426816

DATABASE_URL = os.getenv("DATABASE_URL")
POSTGRES_URL = os.getenv("POSTGRES_URL")

LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "696438a21fc540d4cb27faa736239e75")
LASTFM_API_SECRET = os.getenv("LASTFM_API_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


COOLDOWN_FILE = "cooldowns.json"

CURRENT_UPDATE_VERSION = "v1.2.0"
CURRENT_UPDATE_MESSAGE = """🎉 **The Goats DJ Update `v1.2.0`** 🎉

- **Dynamic Bot Avatar**: You can now choose to preview and set the bot's profile picture to a beautiful, abstract blur of your current album art directly from `/fm`!
- **Spotify Rich Data Integration**: If your Last.fm track doesn't have an album cover, we now automatically fetch the high-res cover from Spotify.
- **Lyrics Search**: In compact mode, click *More info* to fetch the official lyrics for the track!
- **Settings**: You can now toggle these update notifications in `/settings`. 

*(You can disable these update notifications in `/settings`)*"""

from src.core.theme import Theme

def format_name(user):
    if not user: return "Unknown"
    name = getattr(user, 'name', str(user))
    if name == "gamernation12":
        return "GamerNation12"
    return name

LASTFM_COLOR = Theme.PRIMARY

PERIOD_MAP = {
    '7d': '7day',
    '1m': '1month',
    '3m': '3month',
    '6m': '6month',
    '1y': '12month',
    'all': 'overall'
}

PERIOD_TO_DAYS = {
    '7d': 7, '7day': 7,
    '1m': 30, '1month': 30,
    '3m': 90, '3month': 90,
    '6m': 180, '6month': 180,
    '1y': 365, '12m': 365, '12month': 365,
    'all': 99999, 'overall': 99999
}
