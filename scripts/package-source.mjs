/**
 * Create a tracked-source-only archive via git archive.
 * Rejects secret-bearing and build/artifact paths in the listing.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const outDir = path.join(ROOT, "dist-source");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(outDir, `householdos-source-${stamp}.tar.gz`);

fs.mkdirSync(outDir, { recursive: true });

execSync(`git archive --format=tar.gz --output="${outFile}" HEAD`, {
  cwd: ROOT,
  stdio: "inherit",
});

const tarList = execSync(`tar -tzf "${outFile}"`, { encoding: "utf8" });
const names = tarList.split(/\r?\n/).filter(Boolean);

const FORBIDDEN = [
  /^\.env(?!\.example$)/,
  /^\.git\//,
  /^node_modules\//,
  /^\.next\//,
  /^test-results\//,
  /^playwright-report\//,
  /^coverage\//,
  /^public\/ocr\//,
  /^public\/pdfjs\//,
  /\.env\.local$/,
];

const bad = names.filter((n) => FORBIDDEN.some((re) => re.test(n)));
if (bad.length) {
  console.error("package:source rejected forbidden paths:");
  for (const b of bad.slice(0, 20)) console.error(`  ${b}`);
  process.exit(1);
}

const manifest = {
  createdAt: new Date().toISOString(),
  fileCount: names.length,
  archive: path.relative(ROOT, outFile).replace(/\\/g, "/"),
  sample: names.slice(0, 10),
};
fs.writeFileSync(
  path.join(outDir, "package-source-manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(`package:source ok → ${manifest.archive} (${manifest.fileCount} paths)`);
