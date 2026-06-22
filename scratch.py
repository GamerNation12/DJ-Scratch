import urllib.request, json, urllib.parse
url = f"https://itunes.apple.com/search?term={urllib.parse.quote('DJ Snake Let Me Love You')}&entity=song&limit=1"
try:
    print(json.dumps(json.loads(urllib.request.urlopen(url).read()), indent=2))
except Exception as e:
    print(e)
