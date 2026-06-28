import os
import re

api_dir = r"c:\Users\minec\Documents\GitHub\DJ-Scratch\web\src\app\api"

for root, dirs, files in os.walk(api_dir):
    for file in files:
        if file == "route.ts":
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            if "next-auth/next" in content:
                # Replace imports
                content = re.sub(r'import\s+{\s*getServerSession\s*}\s+from\s+"next-auth/next";\n?', '', content)
                content = re.sub(r'import\s+{\s*authOptions\s*}\s+from\s+"@/lib/authOptions";\n?', '', content)
                
                # Add verifyToken import if not there
                if "verifyToken" not in content:
                    content = 'import { verifyToken } from "@/lib/jwt";\n' + content

                # Replace session getter
                # Need to find the request variable name, usually `req: Request` or `request: Request`
                # Let's just find `const session = await getServerSession(authOptions);`
                
                # We need access to headers. The Next.js request object has it.
                # If the function is POST(req: Request) or GET(req: Request)
                
                new_session_code = """const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;"""

                content = content.replace("const session = await getServerSession(authOptions);", new_session_code)
                
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Updated {path}")
