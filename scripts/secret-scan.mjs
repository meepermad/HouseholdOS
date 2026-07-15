import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "test-results",
  "playwright-report",
  "coverage",
  ".turbo",
  ".temp", // supabase CLI local cache (pooler-url etc.)
]);

const PATTERNS = [
  { name: "supabase-jwt", re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: "postgres-uri", re: /postgres(?:ql)?:\/\/[^\s'"]+/gi },
  { name: "supabase-service-role-env", re: /SUPABASE_SECRET_KEY\s*=\s*['\"]?eyJ/g },
  { name: "vercel-token", re: /\bvercel_[A-Za-z0-9]{20,}\b/g },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
];

const FORBIDDEN_TRACKED = [
  ".env",
  ".env.local",
  ".vercel",
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const badTracked = tracked.filter((f) =>
  FORBIDDEN_TRACKED.some((x) => f === x || f.startsWith(`${x}/`)),
);
if (badTracked.length) {
  console.error("Forbidden tracked files:", badTracked.join(", "));
  process.exit(1);
}

let hits = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/secret-scan")) continue;
  if (rel.includes(".env")) continue;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      console.error(`Secret-scan hit (${name}) in ${rel}`);
      hits += 1;
    }
  }
}

if (hits > 0) {
  console.error(`Secret scan failed with ${hits} hit(s).`);
  process.exit(1);
}

console.log("Secret scan passed.");
