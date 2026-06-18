import os
import psycopg2
from urllib.parse import urlparse

url = urlparse(os.environ['DATABASE_URL'])
conn = psycopg2.connect(
    database=url.path[1:],
    user=url.username,
    password=url.password,
    host=url.hostname,
    port=url.port
)
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
tables = [row[0] for row in cur.fetchall()]
print('Tables:', tables)

for table in tables:
    cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}'")
    cols = [row[0] for row in cur.fetchall()]
    print(f"Table {table}:", cols)
