import {
  IMPORT_DOMAIN_COLUMNS,
  type ImportDomain,
} from "./domains";

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const ALIASES: Record<string, string[]> = {
  name: ["name", "item", "itemname", "title"],
  title: ["title", "name", "event", "eventtitle"],
  category: ["category", "type", "kind"],
  description: ["description", "desc", "details"],
  notes: ["notes", "note", "comment"],
  quantity: ["quantity", "qty", "amount", "count"],
  unit: ["unit", "units", "uom"],
  condition: ["condition", "state"],
  frequency: ["frequency", "recur", "recurrence", "cadence"],
  due_day: ["dueday", "due", "duedate", "day"],
  estimated_amount: ["estimatedamount", "amount", "estimate", "cost"],
  starts_at: ["startsat", "start", "startdate", "begins"],
  ends_at: ["endsat", "end", "enddate"],
  location: ["location", "place", "where"],
};

export type ColumnMapping = Record<string, number | null>;

/** Auto-map CSV headers to domain fields by normalized name / aliases. */
export function autoMapColumns(
  domain: ImportDomain,
  headers: string[],
): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  for (const col of IMPORT_DOMAIN_COLUMNS[domain]) {
    const aliases = ALIASES[col.key] ?? [normalizeHeader(col.key)];
    let found: number | null = null;
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i]!)) {
        found = i;
        break;
      }
    }
    mapping[col.key] = found;
  }
  return mapping;
}

export function applyColumnMapping(
  row: string[],
  mapping: ColumnMapping,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, idx] of Object.entries(mapping)) {
    out[key] = idx === null || idx === undefined ? "" : (row[idx] ?? "").trim();
  }
  return out;
}
