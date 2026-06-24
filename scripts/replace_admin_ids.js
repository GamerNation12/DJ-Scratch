const fs = require('fs');
const path = require('path');

const targetDirs = [
  'web/src/app/api/admin',
  'web/src/app/api/suggestions'
];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  if (filePath.includes('admin/check/route.ts')) return; // skip this one

  if (!content.includes('getAdminRole')) {
    content = 'import { getAdminRole } from "@/lib/admin";\n' + content;
  }

  // Common pattern 1:
  // if (!session || (session.user as any)?.id !== "759433582107426816") {
  content = content.replace(
    /if \(!session \|\| \(session\.user as any\)\?\.id !== "759433582107426816"\) \{/g,
    'const role = session ? await getAdminRole((session.user as any)?.id) : null;\n  if (!role || (role !== "owner" && role !== "admin")) {'
  );

  // Pattern 2 (in suggestions routes):
  // const ADMIN_ID = "759433582107426816";
  // const isAdmin = userId === ADMIN_ID;
  if (content.includes('const isAdmin = userId === ADMIN_ID;')) {
    content = content.replace('const isAdmin = userId === ADMIN_ID;', 'const role = await getAdminRole(userId);\n  const isAdmin = role === "owner" || role === "admin" || role === "moderator";');
  }

  // Pattern 3 (in admin/stats/route.ts):
  // if (!decoded || decoded.id !== "759433582107426816") {
  if (content.includes('if (!decoded || decoded.id !== "759433582107426816") {')) {
    content = content.replace(
      /if \(!decoded \|\| decoded\.id !== "759433582107426816"\) \{/g,
      'const role = decoded ? await getAdminRole(decoded.id) : null;\n  if (!role || (role !== "owner" && role !== "admin")) {'
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

targetDirs.forEach(processDir);
