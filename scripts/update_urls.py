import os

d = 'web/src/app/api'
for r, dirs, files in os.walk(d):
    for f in files:
        if f.endswith('.ts'):
            p = os.path.join(r, f)
            with open(p, 'r', encoding='utf-8') as file:
                c = file.read()
            changed = False
            if "process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'" in c:
                c = c.replace("process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'", "'https://the-goats-dj.vercel.app'")
                changed = True
            if "process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'" in c:
                c = c.replace("process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'", "'http://the-goats-dj.hostedbyfps.com'")
                changed = True
            if changed:
                with open(p, 'w', encoding='utf-8') as file:
                    file.write(c)
