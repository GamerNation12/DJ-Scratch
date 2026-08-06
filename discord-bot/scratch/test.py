import re

texts = [
    "Your top tracks for 'David Kushner'",
    "Your top albums for 'David Kushner'"
]

for text in texts:
    m = re.search(r"top \w+ for ['`‘]([^'`’]+)['`’]", text)
    if m:
        print("MATCH:", m.group(1))
    else:
        print("NO MATCH FOR:", text)
