/**
 * CSV parse/export helpers. No formula execution.
 */

export function neutralizeSpreadsheetInjection(value: string): string {
  if (!value) return value;
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed) || trimmed.startsWith("\t")) {
    return `'${value}`;
  }
  return value;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };
  const pushRow = () => {
    // Skip completely empty trailing rows
    if (current.length === 1 && current[0] === "" && rows.length === 0) {
      current = [];
      return;
    }
    rows.push(current);
    current = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    field += ch;
  }
  pushField();
  if (current.length > 1 || (current.length === 1 && current[0] !== "")) {
    pushRow();
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0]!.map((h) => h.trim());
  const body = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { headers, rows: body };
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    const safe = neutralizeSpreadsheetInjection(v);
    if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((_, i) => escape(row[i] ?? "")).join(","));
  }
  return lines.join("\n");
}

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
