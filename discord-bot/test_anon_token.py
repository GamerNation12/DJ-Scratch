import urllib.request
import re

req = urllib.request.Request('https://open.spotify.com/', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    token_match = re.search(r'"accessToken":"(.*?)"', html)
    if token_match:
        print("TOKEN FOUND:", token_match.group(1)[:20] + "...")
    else:
        print("NO TOKEN IN HTML")
except Exception as e:
    print("ERROR:", e)
