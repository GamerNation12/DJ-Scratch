with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/api/admin/commands/route.ts', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Insert the getAdminRole import
if 'getAdminRole' not in text:
    text = text.replace('import { verifyToken } from "@/lib/jwt";', 'import { verifyToken } from "@/lib/jwt";\nimport { getAdminRole } from "@/lib/admin";')

auth_logic = '''    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;
    const role = user ? await getAdminRole((user as any)?.id) : null;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }'''

# Replace GET
text = re.sub(r'    const authHeader.*?return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n    \}', auth_logic, text, count=1, flags=re.DOTALL)

# Replace POST
text = re.sub(r'    const authHeader.*?return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n    \}', auth_logic, text, count=1, flags=re.DOTALL)

# Replace DELETE
text = re.sub(r'    const authHeader.*?return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n    \}', auth_logic, text, count=1, flags=re.DOTALL)


with open('c:/Users/minec/Documents/GitHub/The-Goats-Dj/web/src/app/api/admin/commands/route.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated authorization logic')
