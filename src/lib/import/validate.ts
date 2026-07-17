import { IMPORT_DOMAIN_COLUMNS, type ImportDomain } from "./domains";
import { applyColumnMapping, type ColumnMapping } from "./map-columns";
import { IMPORT_MAX_ROWS } from "./csv";

export type ValidatedImportRow = {
  rowNumber: number;
  mapped: Record<string, string>;
  status: "valid" | "warning" | "error";
  messages: string[];
};

export function validateImportRows(
  domain: ImportDomain,
  rows: string[][],
  mapping: ColumnMapping,
): ValidatedImportRow[] {
  const cols = IMPORT_DOMAIN_COLUMNS[domain];
  const results: ValidatedImportRow[] = [];
  const limited = rows.slice(0, IMPORT_MAX_ROWS);

  for (let i = 0; i < limited.length; i++) {
    const mapped = applyColumnMapping(limited[i]!, mapping);
    const messages: string[] = [];
    let status: ValidatedImportRow["status"] = "valid";

    for (const col of cols) {
      if (col.required && !mapped[col.key]) {
        messages.push(`Missing required field: ${col.label}`);
        status = "error";
      }
    }

    if (domain === "utilities" && mapped.due_day) {
      const day = Number(mapped.due_day);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        messages.push("Due day must be an integer from 1 to 28");
        status = "error";
      }
    }

    if (domain === "calendar_events" && mapped.starts_at) {
      if (Number.isNaN(Date.parse(mapped.starts_at))) {
        messages.push("Starts at must be a valid date/time");
        status = "error";
      }
    }

    if (mapped.name && mapped.name.length > 200) {
      messages.push("Name is too long");
      status = "error";
    }

    results.push({
      rowNumber: i + 2, // 1-indexed CSV with header
      mapped,
      status,
      messages,
    });
  }

  if (rows.length > IMPORT_MAX_ROWS) {
    results.push({
      rowNumber: IMPORT_MAX_ROWS + 2,
      mapped: {},
      status: "warning",
      messages: [`Only the first ${IMPORT_MAX_ROWS} rows will be imported`],
    });
  }

  return results;
}
