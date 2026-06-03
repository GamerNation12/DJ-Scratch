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

LASTFM_API_KEY = "3a9ab8d067efbf07deca276e03fb8ce7"
LASTFM_API_SECRET = "834bf54c6de145d24bce62857e4e1a06"

USERS_FILE = "lastfm_users.json"
COOLDOWN_FILE = "cooldowns.json"
LASTFM_COLOR = 0xb90000

PERIOD_MAP = {
    '7d': '7day',
    '1m': '1month',
    '3m': '3month',
    '6m': '6month',
    '1y': '12month',
    'all': 'overall'
}

PERIOD_TO_DAYS = {
    '7d': 7,
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
    'all': 99999
}
