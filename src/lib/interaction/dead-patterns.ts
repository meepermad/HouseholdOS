/** Source patterns that usually mean a visible control does nothing. */
export const DEAD_INTERACTION_PATTERNS = [
  { id: "empty_href", source: 'href="#"' },
  { id: "void_href", source: "javascript:void" },
  { id: "empty_click", source: "onClick={() => {}}" },
  { id: "not_implemented", source: "Not implemented" },
  { id: "coming_soon", source: "Coming soon" },
] as const;

export type DeadPatternHit = {
  patternId: string;
  file: string;
  line: number;
  excerpt: string;
};

const IGNORE_FILES = [
  "dead-patterns.ts",
  "dead-patterns.test.ts",
  "interaction-integrity",
  "dev-integrity-observer",
];

export function scanSourceForDeadPatterns(
  files: Array<{ path: string; contents: string }>,
): DeadPatternHit[] {
  const hits: DeadPatternHit[] = [];
  for (const file of files) {
    if (IGNORE_FILES.some((name) => file.path.includes(name))) continue;
    const lines = file.contents.split(/\r?\n/);
    for (const pattern of DEAD_INTERACTION_PATTERNS) {
      lines.forEach((line, index) => {
        if (line.includes(pattern.source)) {
          hits.push({
            patternId: pattern.id,
            file: file.path,
            line: index + 1,
            excerpt: line.trim().slice(0, 160),
          });
        }
      });
    }
  }
  return hits;
}
