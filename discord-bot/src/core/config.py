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

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
POSTGRES_URL = os.getenv("POSTGRES_URL", "").strip()

LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "eee299142ac5fe73e5eb5dcd1c29bcae").strip()
LASTFM_API_SECRET = os.getenv("LASTFM_API_SECRET", "e566dd2098e65ed746edc1a4a5ef62f0").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

COOLDOWN_FILE = "cooldowns.json"

CURRENT_UPDATE_VERSION = "v1.3.0"
CURRENT_UPDATE_MESSAGE = """🎉 **DJ Scratch Update `v1.3.0`** 🎉

✨ **New Feature:** Premium UI Overhaul with Dynamic Theming Engine, bringing a fresh and professional look to the platform, including dynamic theming for all embeds, a new premium teaser command, and polished help center and paginators. 

🔧 **Update:** Standardized error embeds for a more consistent user experience.

*(You can disable these update notifications in `/settings`)*"""

from src.core.theme import Theme

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
