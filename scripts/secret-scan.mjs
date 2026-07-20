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
  ".temp",
]);

const PATTERNS = [
  { name: "supabase-jwt", re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: "supabase-secret-prefix", re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name: "postgres-uri", re: /postgres(?:ql)?:\/\/[^\s'"]+/gi },
  { name: "supabase-service-role-env", re: /SUPABASE_SECRET_KEY\s*=\s*['\"]?(?:eyJ|sb_secret_)/g },
  { name: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "oauth-client-secret", re: /CLIENT_SECRET\s*=\s*['\"]?[A-Za-z0-9_-]{16,}/g },
  { name: "worker-secret-assignment", re: /(?:NOTIFICATION|DOCUMENT_JOB|EXPORT|SYNC)_WORKER_SECRET\s*=\s*['\"]?[^\s'"]{16,}/g },
  { name: "vercel-token", re: /\bvercel_[A-Za-z0-9]{20,}\b/g },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
];

function isAllowedEnvExample(rel) {
  return rel === ".env.example" || rel.endsWith("/.env.example");
}

function isForbiddenEnv(rel) {
  const base = path.basename(rel);
  if (!base.startsWith(".env")) return false;
  return !isAllowedEnvExample(rel);
}

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

const badTracked = tracked.filter((f) => {
  const rel = f.replace(/\\/g, "/");
  if (isForbiddenEnv(rel)) return true;
  if (rel === ".vercel" || rel.startsWith(".vercel/")) return true;
  return false;
});
if (badTracked.length) {
  console.error("Forbidden tracked files:", badTracked.join(", "));
  process.exit(1);
}

let hits = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/secret-scan")) continue;
  if (rel.startsWith("docs/")) continue;
  if (isAllowedEnvExample(rel)) continue;
  // Local untracked env files are gitignored; do not fail the walk on them.
  // Tracked forbidden env files are already rejected above.
  if (isForbiddenEnv(rel)) continue;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      // Never print the secret value — path + pattern name only.
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
