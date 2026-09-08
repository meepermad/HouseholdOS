import { parsePastedCents } from "./cents";
import { OWNERSHIP_HINT_WORDS, PASTE_FORMAT_VERSION, type OwnershipHintKind } from "./format";
import {
  normalizeReceiptPasteInput,
  splitUnescapedPipes,
  unwrapMarkdownLine,
} from "./normalize";
import {
  type PasteProblem,
  type PasteProblemCode,
  type PasteProblemSeverity,
  canContinueItemized,
  userFacingPasteError,
} from "./problems";
import { PASTE_MAX_CHARS, sanitizePastedReceipt } from "./sanitize";

export type PasteMember = { id: string; label: string };

export type { PasteProblem, PasteProblemCode, PasteProblemSeverity };

export type ParsedPasteItem = {
  description: string;
  /** Line total in cents. Quantity must not re-multiply this. */
  totalCents: number;
  quantity: number;
  derivedUnitPriceCents: number;
  ownershipHint: string | null;
  ownershipKind: OwnershipHintKind | null;
  suggestedMembershipId: string | null;
  needsReview: boolean;
  raw: string;
  sourceLineNumber: number;
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
  formatVersion: number;
  originalText: string;
  extractedBlock: string;
  normalizedText: string;
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

const FIELD_RE =
  /^(merchant|date|paid\s*by|paidby|total|subtotal|tax|tip|fees?|discount|format)\s*[:\-\u2013\u2014]\s*(.+)$/i;

function problem(
  code: PasteProblemCode,
  message: string,
  extra?: Omit<Partial<PasteProblem>, "code" | "message"> & {
    severity?: PasteProblemSeverity;
  },
): PasteProblem {
  const severity =
    extra?.severity ??
    (code === "missing_end" ||
    code === "duplicate_field" ||
    code === "paid_by_unmatched" ||
    code === "totals_mismatch"
      ? "review"
      : "blocker");
  return { code, message, severity, ...extra };
}

function looksLikeHtml(text: string): boolean {
  return /<\s*(script|iframe|object|embed|svg|img|html|body|style)\b/i.test(text);
}

export function isReceiptHeaderLine(line: string): boolean {
  return /^householdos\s+receipt\s*:?\s*$/i.test(unwrapMarkdownLine(line));
}

export function isReceiptEndLine(line: string): boolean {
  return /^end\s*:?\s*$/i.test(unwrapMarkdownLine(line));
}

export function isReceiptItemsLine(line: string): boolean {
  return /^items\s*:?\s*$/i.test(unwrapMarkdownLine(line));
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

function derivedUnitPriceCents(lineTotalCents: number, quantity: number): number {
  if (quantity <= 1) return lineTotalCents;
  return Math.trunc(lineTotalCents / quantity);
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
      problem: problem("negative_amount", "A negative amount is only valid as a discount.", {
        reason: "This amount cannot be negative.",
        suggestedAction: "Correct the amount, then try again.",
      }),
    };
  }
  if (parsed.error === "overflow") {
    return {
      cents: null,
      problem: problem("overflow_amount", "That amount is too large to import safely.", {
        reason: "This amount is larger than HouseholdOS can store.",
        suggestedAction: "Check the total and try again.",
      }),
    };
  }
  return {
    cents: null,
    problem: problem("malformed_amount", "We could not read one of the dollar amounts.", {
      reason: "This does not look like a dollar amount.",
      suggestedAction: "Use a number like 12.34 or $12.34.",
    }),
  };
}

export function extractCanonicalBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isReceiptHeaderLine(lines[i])) {
      if (start >= 0) {
        blocks.push(lines.slice(start, i).join("\n"));
      }
      start = i;
    } else if (start >= 0 && isReceiptEndLine(lines[i])) {
      blocks.push(lines.slice(start, i + 1).join("\n"));
      start = -1;
    }
  }
  if (start >= 0) {
    blocks.push(lines.slice(start).join("\n"));
  }
  return blocks;
}

function parseQuantity(raw: string): { quantity: number } | { problem: PasteProblem } {
  const text = raw.trim();
  if (!text) return { quantity: 1 };
  if (/^\d+$/.test(text)) {
    const quantity = Number.parseInt(text, 10);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
      return {
        problem: problem("malformed_quantity", "We could not read the quantity on this line.", {
          severity: "review",
          reason: "Could not read quantity.",
          suggestedAction: "Use a whole number from 1 to 999, or leave quantity off.",
        }),
      };
    }
    return { quantity };
  }
  if (/^\d+\.0+$/.test(text)) {
    return parseQuantity(text.split(".")[0] ?? text);
  }
  return {
    problem: problem("malformed_quantity", "We could not read the quantity on this line.", {
      severity: "review",
      reason: "Could not read quantity.",
      suggestedAction: "Use a whole number like 1 or 2. Quantity is how many items, not a multiplier for the price.",
    }),
  };
}

function parseItemLine(
  raw: string,
  lineNumber: number,
  members: readonly PasteMember[],
): ParsedPasteItem | { problem: PasteProblem } {
  const parts = splitUnescapedPipes(raw);
  const lineMeta = {
    lineNumber,
    originalLine: raw,
  };

  if (parts.length < 2 || !parts[0]) {
    return {
      problem: problem("ambiguous", "We couldn't read this line.", {
        severity: "review",
        ...lineMeta,
        reason: "This item line is missing a name or a price.",
        suggestedAction: "Use: Description | 4.97 | 1",
      }),
    };
  }

  if (parts.length > 4) {
    return {
      problem: problem(
        "too_many_delimiters",
        "This line has too many | characters.",
        {
          severity: "review",
          ...lineMeta,
          reason: "Too many unescaped | delimiters.",
          suggestedAction: 'If the name contains |, write it as \\| — for example: Candy \\| Special Edition | 4.99 | 1',
        },
      ),
    };
  }

  const amount = parseAmountField(parts[1], { allowNegative: false });
  if (amount.problem) {
    const overflow = amount.problem.code === "overflow_amount";
    return {
      problem: {
        ...amount.problem,
        severity: overflow ? "blocker" : "review",
        ...lineMeta,
        reason: amount.problem.reason ?? "Could not read the line total.",
        suggestedAction:
          parts.length >= 3
            ? "If the name contains |, write it as \\|. Otherwise correct the price."
            : (amount.problem.suggestedAction ?? "Correct the price on this line."),
      },
    };
  }
  if (amount.cents == null) {
    return {
      problem: problem("malformed_amount", "We could not read this item amount.", {
        severity: "review",
        ...lineMeta,
        reason: "Could not read the line total.",
        suggestedAction: "Use a number like 4.97 or $4.97.",
      }),
    };
  }

  let quantity = 1;
  if (parts[2]) {
    const parsedQty = parseQuantity(parts[2]);
    if ("problem" in parsedQty) {
      return { problem: { ...parsedQty.problem, ...lineMeta } };
    }
    quantity = parsedQty.quantity;
  }

  const ownership = parseOwnershipHint(parts[3], members);
  return {
    description: parts[0].slice(0, 200),
    totalCents: amount.cents,
    quantity,
    derivedUnitPriceCents: derivedUnitPriceCents(amount.cents, quantity),
    ...ownership,
    needsReview: Boolean(parts[3] && !ownership.ownershipKind),
    raw,
    sourceLineNumber: lineNumber,
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
  formatVersion: number | null;
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
    formatVersion: null,
  };
}

function applyField(
  fields: HeaderFields,
  name: string,
  value: string,
  problems: PasteProblem[],
  lineNumber: number,
  originalLine: string,
): void {
  const key = name.replace(/\s+/g, "").toLowerCase();
  const setOnce = (current: unknown, assign: () => void) => {
    if (current != null && current !== "") {
      problems.push(
        problem("duplicate_field", "This receipt lists the same field more than once.", {
          severity: "review",
          lineNumber,
          originalLine,
          reason: "This field appears twice.",
          suggestedAction: "Keep the first value or delete the extra line.",
        }),
      );
      return;
    }
    assign();
  };

  if (key === "format") {
    setOnce(fields.formatVersion, () => {
      const version = value.trim();
      if (!version || version === "1") {
        fields.formatVersion = PASTE_FORMAT_VERSION;
        return;
      }
      problems.push(
        problem(
          "unknown_format",
          "This receipt uses a format HouseholdOS does not support yet.",
          {
            lineNumber,
            originalLine,
            reason: `Unknown format ${version}.`,
            suggestedAction: "Use Format: 1, or remove the Format line.",
          },
        ),
      );
    });
    return;
  }
  if (key === "merchant") {
    setOnce(fields.merchant, () => {
      fields.merchant = value.trim().slice(0, 200) || null;
    });
    return;
  }
  if (key === "date") {
    setOnce(fields.purchaseDate, () => {
      fields.purchaseDate = normalizeDate(value);
      if (value.trim() && !fields.purchaseDate) {
        problems.push(
          problem("ambiguous", "We could not read the date, so it was skipped.", {
            severity: "review",
            lineNumber,
            originalLine,
            reason: "This date could not be read.",
            suggestedAction: "Use YYYY-MM-DD, or leave the date blank.",
          }),
        );
      }
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
    const isRequiredTotal = key === "total";
    problems.push({
      ...amount.problem,
      severity: isRequiredTotal ? "blocker" : "review",
      lineNumber,
      originalLine,
    });
    return;
  }
  if (key === "total") {
    setOnce(fields.totalCents, () => {
      fields.totalCents = amount.cents;
    });
  } else if (key === "subtotal") {
    setOnce(fields.subtotalCents, () => {
      fields.subtotalCents = amount.cents;
    });
  } else if (key === "tax") {
    setOnce(fields.taxCents, () => {
      fields.taxCents = amount.cents;
    });
  } else if (key === "tip") {
    setOnce(fields.tipCents, () => {
      fields.tipCents = amount.cents;
    });
  } else if (key === "fee" || key === "fees") {
    setOnce(fields.feeCents, () => {
      fields.feeCents = amount.cents;
    });
  } else if (key === "discount") {
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
  normalizedText: string,
): PasteParseResult {
  const problems: PasteProblem[] = [];
  const lines = block.split("\n");
  const hasEnd = lines.some((l) => isReceiptEndLine(l));
  if (!hasEnd) {
    problems.push(
      problem("missing_end", "This receipt is missing an END line.", {
        severity: "review",
        reason: "The END marker was not found.",
        suggestedAction: "Add END as the last line of the receipt block.",
      }),
    );
  }

  const fields = emptyFields();
  const items: ParsedPasteItem[] = [];
  let inItems = false;
  let sawItems = false;
  const blockStartInNormalized = (() => {
    const idx = normalizedText.indexOf(block);
    if (idx <= 0) return 0;
    return normalizedText.slice(0, idx).split("\n").length - 1;
  })();

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = blockStartInNormalized + i + 1;
    const trimmed = unwrapMarkdownLine(lines[i]);
    if (!trimmed || isReceiptHeaderLine(trimmed) || isReceiptEndLine(trimmed)) continue;
    if (isReceiptItemsLine(trimmed)) {
      inItems = true;
      sawItems = true;
      continue;
    }
    const field = trimmed.match(FIELD_RE);
    if (field && !inItems) {
      applyField(fields, field[1], field[2], problems, lineNumber, lines[i]);
      continue;
    }
    if (inItems) {
      if (FIELD_RE.test(trimmed) && !trimmed.includes("|")) {
        inItems = false;
        applyField(
          fields,
          trimmed.match(FIELD_RE)![1],
          trimmed.match(FIELD_RE)![2],
          problems,
          lineNumber,
          lines[i],
        );
        continue;
      }
      const item = parseItemLine(trimmed, lineNumber, members);
      if ("problem" in item) problems.push(item.problem);
      else items.push(item);
    }
  }

  if (!sawItems) {
    problems.push(
      problem("missing_items", "This receipt is missing an ITEMS section.", {
        reason: "The ITEMS marker was not found.",
        suggestedAction: "Add an ITEMS heading, then one item per line.",
      }),
    );
  }
  if (!fields.merchant) {
    problems.push(
      problem("missing_merchant", "This receipt still needs a store name.", {
        reason: "Merchant is required.",
        suggestedAction: "Add a line like Merchant: Walmart.",
      }),
    );
  }
  if (fields.totalCents == null) {
    problems.push(
      problem("missing_total", "This receipt still needs a total.", {
        reason: "Total is required.",
        suggestedAction: "Add a line like Total: 55.41.",
      }),
    );
  }

  const payer = fields.paidByRaw ? matchMember(fields.paidByRaw, members) : null;
  if (fields.paidByRaw && !payer) {
    problems.push(
      problem("paid_by_unmatched", "Paid-by person could not be matched", {
        severity: "review",
        reason: "That name is not a household member.",
        suggestedAction: "Choose who paid on the next screen.",
      }),
    );
  }

  const formatVersion = fields.formatVersion ?? PASTE_FORMAT_VERSION;
  const receipt: ParsedPasteReceipt = {
    merchant: fields.merchant,
    purchaseDate: fields.purchaseDate,
    paidByRaw: fields.paidByRaw,
    totalCents: fields.totalCents,
    subtotalCents: fields.subtotalCents,
    taxCents: fields.taxCents,
    tipCents: fields.tipCents,
    feeCents: fields.feeCents,
    discountCents: fields.discountCents,
    items,
    payerMembershipId: payer?.id ?? null,
    sourceKind: "canonical",
    formatVersion,
    originalText,
    extractedBlock: block.trim(),
    normalizedText,
  };

  const fatal = problems.some((p) => p.severity === "blocker");
  if (fatal) {
    return {
      ok: false,
      error:
        problems.find((p) => p.severity === "blocker") ??
        problem("ambiguous", "We could not confidently understand part of this receipt."),
      problems,
      receipt,
    };
  }

  return { ok: true, receipt, problems };
}

function parseQuickFormat(
  text: string,
  members: readonly PasteMember[],
  originalText: string,
): ParsedPasteReceipt | null {
  const lines = text
    .split("\n")
    .map((l) => unwrapMarkdownLine(l))
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (lines.some((l) => isReceiptHeaderLine(l))) return null;
  if (lines[0].includes("|")) return null;
  const total = parsePastedCents(lines[1]);
  if (!total.ok) return null;
  const merchant = lines[0].replace(/^merchant\s*[:\-\u2013\u2014]\s*/i, "").trim();
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
      formatVersion: PASTE_FORMAT_VERSION,
      originalText,
      extractedBlock: text.trim(),
      normalizedText: text,
    };
  }

  for (let i = 0; i < itemLines.length; i++) {
    const line = itemLines[i];
    if (!line.includes("|")) return null;
    const item = parseItemLine(line, i + 3, members);
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
    formatVersion: PASTE_FORMAT_VERSION,
    originalText,
    extractedBlock: text.trim(),
    normalizedText: text,
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

  const normalized = normalizeReceiptPasteInput(sanitized.text);
  const text = normalized.text;
  const problems: PasteProblem[] = [];

  const headerCount = text.split("\n").filter((l) => isReceiptHeaderLine(l)).length;
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
    if (looksLikeHtml(blocks[0])) {
      problems.push(
        problem("html_or_script", "This paste looks like a web page, not a receipt.", {
          reason: "HTML or script tags were found.",
          suggestedAction: "Paste the receipt text, not a web page.",
        }),
      );
    }
    const parsed = parseCanonicalBlock(blocks[0], members, raw, text);
    const merged = [...problems, ...parsed.problems];
    const blocker = merged.find((p) => p.severity === "blocker");
    if (blocker) {
      return {
        ok: false,
        error: blocker,
        problems: merged,
        receipt: parsed.receipt,
      };
    }
    if (parsed.ok) {
      return { ...parsed, problems: merged };
    }
    return {
      ...parsed,
      problems: merged,
      error: parsed.error,
    };
  }

  const quick = parseQuickFormat(text, members, raw);
  if (quick && (quick.items.length > 0 || quick.totalCents != null) && quick.merchant) {
    return {
      ok: false,
      error: problem("ambiguous", "We think this is a receipt.", { severity: "review" }),
      problems: [
        ...problems,
        problem("ambiguous", "We think this is a receipt.", { severity: "review" }),
      ],
      receipt: null,
      quickCandidate: quick,
    };
  }

  if (looksLikeHtml(text)) {
    const error = problem("html_or_script", "This paste looks like a web page, not a receipt.", {
      reason: "HTML or script tags were found.",
      suggestedAction: "Paste the receipt text, not a web page.",
    });
    return { ok: false, error, problems: [...problems, error], receipt: null };
  }

  const error = problem(
    "ambiguous",
    "We could not find a HouseholdOS receipt in that paste.",
    {
      reason: "No HOUSEHOLDOS RECEIPT block was found.",
      suggestedAction: "Paste the block that starts with HOUSEHOLDOS RECEIPT and ends with END.",
    },
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

export { canContinueItemized, userFacingPasteError };
