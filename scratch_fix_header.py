with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'body: JSON.stringify({ command_name: lockCommandName, reason: lockReason })',
    'headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ command_name: lockCommandName, reason: lockReason })'
)

with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/admin/AdminClient.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Added Content-Type header')
