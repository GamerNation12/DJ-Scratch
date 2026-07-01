import os
import hashlib
import requests
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

API_KEY = os.getenv("LASTFM_API_KEY")
SECRET = os.getenv("LASTFM_API_SECRET")

if not API_KEY or not SECRET:
    print("Error: LASTFM_API_KEY or LASTFM_API_SECRET is missing in your .env file.")
    exit(1)

print("=== Last.fm Session Key Generator ===")
print("1. Click the link below to authorize the bot on your new Last.fm account:")
print(f"   http://www.last.fm/api/auth/?api_key={API_KEY}")
print("2. Once you click 'Yes, Allow Access', you will be redirected.")
print("3. Look at the URL in your browser. It will look like: .../?token=SOME_TOKEN_HERE")
print("---------------------------------------")

token = input("Paste the token from the URL here: ").strip()

if not token:
    print("Token is required!")
    exit(1)

# Generate API Signature
sig_string = f"api_key{API_KEY}methodauth.getSessiontoken{token}{SECRET}"
api_sig = hashlib.md5(sig_string.encode('utf-8')).hexdigest()

# Request the session key
url = f"http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key={API_KEY}&token={token}&api_sig={api_sig}&format=json"
res = requests.get(url)
data = res.json()

if "session" in data:
    session_key = data["session"]["key"]
    username = data["session"]["name"]
    print("\n✅ SUCCESS!")
    print(f"Account: {username}")
    print(f"Session Key: {session_key}")
    print("\nCopy the Session Key above and add it to your .env file as:")
    print(f"BOT_LASTFM_SESSION_KEY={session_key}")
else:
    print("\n❌ Failed to get session key. Error:")
    print(data)
