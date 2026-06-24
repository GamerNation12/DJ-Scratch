import re
with open('web/src/app/admin/AdminClient.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('await fetch(', 'await fetchApi(')

if 'import { fetchApi }' not in c:
    c = 'import { fetchApi } from "@/lib/fetchApi";\n' + c

with open('web/src/app/admin/AdminClient.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
