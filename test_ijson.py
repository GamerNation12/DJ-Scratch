import ijson
import io

data = b'[{"track_name": "test"}, {"track_name": "test2"}]'
f = io.BytesIO(data)
for track in ijson.items(f, 'item'):
    print(track)
