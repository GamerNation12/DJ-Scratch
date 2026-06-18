import re
with open('web/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('await fetch(', 'await fetchApi(')
c = c.replace('fetch("/api/settings")', 'fetchApi("/api/settings")')
c = c.replace('fetch("/api/suggestions")', 'fetchApi("/api/suggestions")')

if 'import { fetchApi }' not in c:
    c = 'import { fetchApi } from "@/lib/fetchApi";\n' + c

with open('web/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
