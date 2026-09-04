import { parsePastedCents } from "./cents";
import { OWNERSHIP_HINT_WORDS, type OwnershipHintKind } from "./format";
import { PASTE_MAX_CHARS, sanitizePastedReceipt } from "./sanitize";

export type PasteMember = { id: string; label: string };

export type PasteProblemCode =
  | "empty"
  | "too_large"
  | "multiple_receipts"
  | "missing_end"
  | "missing_items"
  | "missing_merchant"
  | "missing_total"
  | "malformed_amount"
  | "negative_amount"
  | "overflow_amount"
  | "duplicate_field"
  | "paid_by_unmatched"
  | "totals_mismatch"
  | "ambiguous"
  | "html_or_script";

export type PasteProblem = {
  code: PasteProblemCode;
  message: string;
};

export type ParsedPasteItem = {
  description: string;
  totalCents: number;
  quantity: number;
  ownershipHint: string | null;
  ownershipKind: OwnershipHintKind | null;
  suggestedMembershipId: string | null;
  needsReview: boolean;
  raw: string;
};

export type ParsedPasteReceipt = {
  merchant: string | null;
  purchaseDate: string | null;
  paidByRaw: string | null;
  payerMembershipId: string | null;
  totalCents: number | null;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  feeCents: number | null;
  discountCents: number | null;
  items: ParsedPasteItem[];
  sourceKind: "canonical" | "quick";
  originalText: string;
  extractedBlock: string;
};

export type PasteParseResult =
  | {
      ok: true;
      receipt: ParsedPasteReceipt;
      problems: PasteProblem[];
      quickCandidate?: undefined;
    }
  | {
      ok: false;
      error: PasteProblem;
      problems: PasteProblem[];
      receipt: ParsedPasteReceipt | null;
      /** Deterministic quick-format guess the UI may offer with confirmation. */
      quickCandidate?: ParsedPasteReceipt;
    };

const HEADER_RE = /^householdos\s+receipt\s*$/i;
const END_RE = /^end\s*$/i;
const ITEMS_RE = /^items\s*:?\s*$/i;
const FIELD_RE =
  /^(merchant|date|paid\s*by|paidby|total|subtotal|tax|tip|fees?|discount)\s*[:\-]\s*(.+)$/i;

function problem(code: PasteProblemCode, message: string): PasteProblem {
  return { code, message };
}

function looksLikeHtml(text: string): boolean {
  return /<\s*(script|iframe|object|embed|svg|img|html|body|style)\b/i.test(text);
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const month = us[1].padStart(2, "0");
    const day = us[2].padStart(2, "0");
    return `${us[3]}-${month}-${day}`;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (y < 1990 || y > 2100) return null;
  return `${y}-${m}-${day}`;
}

function matchMember(label: string, members: readonly PasteMember[]): PasteMember | null {
  const needle = label.trim().toLowerCase();
  if (!needle) return null;
  const exact = members.filter((m) => m.label.trim().toLowerCase() === needle);
  return exact.length === 1 ? exact[0] : null;
}

function parseOwnershipHint(
  raw: string | undefined,
  members: readonly PasteMember[],
): Pick<ParsedPasteItem, "ownershipHint" | "ownershipKind" | "suggestedMembershipId"> {
  const hint = raw?.trim() ?? "";
  if (!hint) {
    return { ownershipHint: null, ownershipKind: null, suggestedMembershipId: null };
  }
  const lower = hint.toLowerCase();
  if (OWNERSHIP_HINT_WORDS.has(lower)) {
    return {
      ownershipHint: lower,
      ownershipKind: lower as OwnershipHintKind,
      suggestedMembershipId: null,
    };
  }
  const member = matchMember(hint, members);
  if (member) {
    return {
      ownershipHint: hint,
      ownershipKind: "member",
      suggestedMembershipId: member.id,
    };
  }
  return { ownershipHint: hint, ownershipKind: null, suggestedMembershipId: null };
}

function parseAmountField(
  raw: string,
  options?: { allowNegative?: boolean },
): { cents: number | null; problem: PasteProblem | null } {
  const parsed = parsePastedCents(raw, options);
  if (parsed.ok) return { cents: parsed.cents, problem: null };
  if (parsed.error === "negative") {
    return {
      cents: null,
      problem: problem("negative_amount", "A negative amount is only valid as a discount."),
    };
  }
  if (parsed.error === "overflow") {
    return {
      cents: null,
      problem: problem("overflow_amount", "That amount is too large to import safely."),
    };
  }
  return {
    cents: null,
    problem: problem("malformed_amount", "We could not read one of the dollar amounts."),
  };
}

export function extractCanonicalBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (HEADER_RE.test(lines[i].trim())) {
      if (start >= 0) {
        blocks.push(lines.slice(start, i).join("\n"));
      }
      start = i;
    } else if (start >= 0 && END_RE.test(lines[i].trim())) {
      blocks.push(lines.slice(start, i + 1).join("\n"));
      start = -1;
    }
  }
  if (start >= 0) {
    blocks.push(lines.slice(start).join("\n"));
  }
  return blocks;
}

function parseItemLine(
  raw: string,
  members: readonly PasteMember[],
): ParsedPasteItem | { problem: PasteProblem } {
  const parts = raw.split("|").map((p) => p.trim());
  if (parts.length < 2 || !parts[0]) {
    return {
      problem: problem(
        "ambiguous",
        "We could not confidently understand part of this receipt.",
      ),
    };
  }
  const amount = parseAmountField(parts[1], { allowNegative: false });
  if (amount.problem) return { problem: amount.problem };
  if (amount.cents == null) {
    return { problem: problem("malformed_amount", "We could not read one of the item amounts.") };
  }

  let quantity = 1;
  if (parts[2]) {
    if (!/^\d+$/.test(parts[2])) {
      return {
        problem: problem("ambiguous", "We could not confidently understand part of this receipt."),
      };
    }
    quantity = Number.parseInt(parts[2], 10);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
      return {
        problem: problem("ambiguous", "We could not confidently understand part of this receipt."),
      };
    }
  }

  const ownership = parseOwnershipHint(parts[3], members);
  return {
    description: parts[0].slice(0, 200),
    totalCents: amount.cents,
    quantity,
    ...ownership,
    needsReview: Boolean(parts[3] && !ownership.ownershipKind),
    raw,
  };
}

type HeaderFields = {
  merchant: string | null;
  purchaseDate: string | null;
  paidByRaw: string | null;
  totalCents: number | null;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  feeCents: number | null;
  discountCents: number | null;
};

function emptyFields(): HeaderFields {
  return {
    merchant: null,
    purchaseDate: null,
    paidByRaw: null,
    totalCents: null,
    subtotalCents: null,
    taxCents: null,
    tipCents: null,
    feeCents: null,
    discountCents: null,
  };
}

function applyField(
  fields: HeaderFields,
  name: string,
  value: string,
  problems: PasteProblem[],
): void {
  const key = name.replace(/\s+/g, "").toLowerCase();
  const setOnce = (current: unknown, assign: () => void) => {
    if (current != null && current !== "") {
      problems.push(problem("duplicate_field", "This receipt lists the same field more than once."));
      return;
    }
    assign();
  };

  if (key === "merchant") {
    setOnce(fields.merchant, () => {
      fields.merchant = value.trim().slice(0, 200) || null;
    });
    return;
  }
  if (key === "date") {
    setOnce(fields.purchaseDate, () => {
      fields.purchaseDate = normalizeDate(value);
    });
    return;
  }
  if (key === "paidby") {
    setOnce(fields.paidByRaw, () => {
      fields.paidByRaw = value.trim().slice(0, 120) || null;
    });
    return;
  }

  const allowNegative = key === "discount";
  const amount = parseAmountField(value, { allowNegative });
  if (amount.problem) {
    problems.push(amount.problem);
    return;
  }
  if (key === "total") setOnce(fields.totalCents, () => {
    fields.totalCents = amount.cents;
  });
  else if (key === "subtotal") setOnce(fields.subtotalCents, () => {
    fields.subtotalCents = amount.cents;
  });
  else if (key === "tax") setOnce(fields.taxCents, () => {
    fields.taxCents = amount.cents;
  });
  else if (key === "tip") setOnce(fields.tipCents, () => {
    fields.tipCents = amount.cents;
  });
  else if (key === "fee" || key === "fees") setOnce(fields.feeCents, () => {
    fields.feeCents = amount.cents;
  });
  else if (key === "discount") {
    const cents = amount.cents == null ? null : Math.abs(amount.cents);
    setOnce(fields.discountCents, () => {
      fields.discountCents = cents;
    });
  }
}

function parseCanonicalBlock(
  block: string,
  members: readonly PasteMember[],
  originalText: string,
): PasteParseResult {
  const problems: PasteProblem[] = [];
  const lines = block.split("\n");
  const hasEnd = lines.some((l) => END_RE.test(l.trim()));
  if (!hasEnd) {
    problems.push(
      problem("missing_end", "We could not confidently understand part of this receipt."),
    );
  }

  const fields = emptyFields();
  const items: ParsedPasteItem[] = [];
  let inItems = false;
  let sawItems = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || HEADER_RE.test(trimmed) || END_RE.test(trimmed)) continue;
    if (ITEMS_RE.test(trimmed)) {
      inItems = true;
      sawItems = true;
      continue;
    }
    const field = trimmed.match(FIELD_RE);
    if (field && !inItems) {
      applyField(fields, field[1], field[2], problems);
      continue;
    }
    if (inItems) {
      if (FIELD_RE.test(trimmed)) {
        inItems = false;
        applyField(fields, trimmed.match(FIELD_RE)![1], trimmed.match(FIELD_RE)![2], problems);
        continue;
      }
      const item = parseItemLine(trimmed, members);
      if ("problem" in item) problems.push(item.problem);
      else items.push(item);
    }
  }

  if (!sawItems) {
    problems.push(
      problem("missing_items", "We could not confidently understand part of this receipt."),
    );
  }
  if (!fields.merchant) {
    problems.push(problem("missing_merchant", "This receipt still needs a store name."));
  }
  if (fields.totalCents == null) {
    problems.push(problem("missing_total", "This receipt still needs a total."));
  }

  const payer = fields.paidByRaw ? matchMember(fields.paidByRaw, members) : null;
  if (fields.paidByRaw && !payer) {
    problems.push(
      problem("paid_by_unmatched", "Paid-by person could not be matched"),
    );
  }

  const receipt: ParsedPasteReceipt = {
    ...fields,
    items,
    payerMembershipId: payer?.id ?? null,
    sourceKind: "canonical",
    originalText,
    extractedBlock: block.trim(),
  };

  const fatal = problems.some((p) =>
    (
      [
        "malformed_amount",
        "negative_amount",
        "overflow_amount",
        "missing_merchant",
        "missing_total",
        "missing_items",
      ] as PasteProblemCode[]
    ).includes(p.code),
  );

  if (fatal) {
    return {
      ok: false,
      error: problems[0] ?? problem("ambiguous", "We could not confidently understand part of this receipt."),
      problems,
      receipt,
    };
  }

  return { ok: true, receipt, problems };
}

function parseQuickFormat(
  text: string,
  members: readonly PasteMember[],
): ParsedPasteReceipt | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (lines.some((l) => HEADER_RE.test(l))) return null;
  if (lines[0].includes("|")) return null;
  const total = parsePastedCents(lines[1]);
  if (!total.ok) return null;
  const merchant = lines[0].replace(/^merchant\s*[:\-]\s*/i, "").trim();
  if (!merchant || merchant.length > 200) return null;

  const itemLines = lines.slice(2);
  const items: ParsedPasteItem[] = [];
  if (itemLines.length === 0) {
    return {
      merchant,
      purchaseDate: null,
      paidByRaw: null,
      payerMembershipId: null,
      totalCents: total.cents,
      subtotalCents: null,
      taxCents: null,
      tipCents: null,
      feeCents: null,
      discountCents: null,
      items,
      sourceKind: "quick",
      originalText: text,
      extractedBlock: text.trim(),
    };
  }

  for (const line of itemLines) {
    if (!line.includes("|")) return null;
    const item = parseItemLine(line, members);
    if ("problem" in item) return null;
    items.push(item);
  }

  return {
    merchant,
    purchaseDate: null,
    paidByRaw: null,
    payerMembershipId: null,
    totalCents: total.cents,
    subtotalCents: null,
    taxCents: null,
    tipCents: null,
    feeCents: null,
    discountCents: null,
    items,
    sourceKind: "quick",
    originalText: text,
    extractedBlock: text.trim(),
  };
}

export function parseHouseholdOsReceipt(
  raw: string,
  members: readonly PasteMember[] = [],
): PasteParseResult {
  if (raw.length > PASTE_MAX_CHARS) {
    const error = problem("too_large", "That paste is too long. Paste one receipt at a time.");
    return { ok: false, error, problems: [error], receipt: null };
  }

  const sanitized = sanitizePastedReceipt(raw);
  if (!sanitized.ok) {
    const error =
      sanitized.error === "too_large"
        ? problem("too_large", "That paste is too long. Paste one receipt at a time.")
        : problem("empty", "Paste receipt information first.");
    return { ok: false, error, problems: [error], receipt: null };
  }

  const text = sanitized.text;
  const problems: PasteProblem[] = [];
  if (looksLikeHtml(text)) {
    problems.push(
      problem("html_or_script", "We could not confidently understand part of this receipt."),
    );
  }

  const headerCount = text
    .split("\n")
    .filter((l) => HEADER_RE.test(l.trim())).length;
  if (headerCount > 1) {
    const error = problem(
      "multiple_receipts",
      "We found more than one receipt. Paste one receipt at a time.",
    );
    return { ok: false, error, problems: [error, ...problems], receipt: null };
  }

  const blocks = extractCanonicalBlocks(text);
  if (blocks.length > 1) {
    const error = problem(
      "multiple_receipts",
      "We found more than one receipt. Paste one receipt at a time.",
    );
    return { ok: false, error, problems: [error, ...problems], receipt: null };
  }

  if (blocks.length === 1) {
    const parsed = parseCanonicalBlock(blocks[0], members, text);
    return {
      ...parsed,
      problems: [...problems, ...parsed.problems],
    };
  }

  const quick = parseQuickFormat(text, members);
  if (quick && (quick.items.length > 0 || quick.totalCents != null) && quick.merchant) {
    return {
      ok: false,
      error: problem("ambiguous", "We think this is a receipt."),
      problems: [
        ...problems,
        problem("ambiguous", "We think this is a receipt."),
      ],
      receipt: null,
      quickCandidate: quick,
    };
  }

  const error = problem(
    "ambiguous",
    "We could not confidently understand part of this receipt.",
  );
  return { ok: false, error, problems: [...problems, error], receipt: null };
}

export function formatHumanDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
