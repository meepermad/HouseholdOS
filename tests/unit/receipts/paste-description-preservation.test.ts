import { describe, expect, it } from "vitest";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { pastedReceiptToExtraction } from "@/lib/receipts/paste/to-extraction";
import {
  displayDescriptionFromPastedSource,
  pastedLinePersistenceFields,
  resolvePastedDisplayDescription,
} from "@/lib/receipts/paste/display-description";
import { mapPersistedLineToReview } from "@/lib/receipts/paste/review-lines";
import {
  PASTE_FIXTURE_ALDI_AUG20,
  PASTE_FIXTURE_ALDI_AUG20_CORRECTED,
  PASTE_FIXTURE_WALMART_TRASH,
  PASTE_FIXTURE_WALMART_TRASH_CORRECTED,
} from "@/lib/receipts/paste/fixtures";

const ALDI_NAMES = [
  "85/15 Ground Beef",
  "French Green Beans",
  "Yellow Onions",
  "Powdered Sugar",
  "Refried Beans",
  "Fajita Tortillas, 20 count",
];

describe("pasted display description preservation", () => {
  it("parser keeps text before the first unescaped pipe for the ALDI fixture", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20);
    expect(parsed.ok).toBe(true);
    expect(parsed.receipt?.items.map((i) => i.description)).toEqual(ALDI_NAMES);
    expect(parsed.receipt?.items[1]?.raw).toBe("French Green Beans | 5.98 | 2");
  });

  it("extraction maps display_description vs source_text without swapping them", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20);
    expect(parsed.ok).toBe(true);
    const extraction = pastedReceiptToExtraction(parsed.receipt!);
    expect(extraction.lineItems.map((l) => l.name)).toEqual(ALDI_NAMES);
    expect(extraction.lineItems.map((l) => l.displayDescription)).toEqual(ALDI_NAMES);
    expect(extraction.lineItems[1]).toMatchObject({
      name: "French Green Beans",
      displayDescription: "French Green Beans",
      sourceText: "French Green Beans | 5.98 | 2",
      ocrText: "French Green Beans | 5.98 | 2",
      descriptionSource: "pasted",
    });
  });

  it("review mapping never falls back to the raw pipe line", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20);
    const extraction = pastedReceiptToExtraction(parsed.receipt!);
    const review = extraction.lineItems.map((item, index) =>
      mapPersistedLineToReview(
        {
          id: `line-${index}`,
          sortIndex: index,
          ocr_text: item.ocrText,
          corrected_name: item.name,
          source_text: item.sourceText,
        },
        true,
      ),
    );
    expect(review.map((l) => l.correctedName)).toEqual(ALDI_NAMES);
    expect(review.every((l) => !l.correctedName.includes("|"))).toBe(true);
  });

  it("recovers display names when corrected_name was stored as the raw source line", () => {
    const recovered = mapPersistedLineToReview(
      {
        ocr_text: "French Green Beans | 5.98 | 2",
        corrected_name: "French Green Beans | 5.98 | 2",
        source_text: "French Green Beans | 5.98 | 2",
      },
      true,
    );
    expect(recovered.correctedName).toBe("French Green Beans");
    expect(recovered.sourceText).toBe("French Green Beans | 5.98 | 2");
  });

  it("recovers display names when corrected_name is missing", () => {
    const recovered = mapPersistedLineToReview(
      {
        ocr_text: "Fajita Tortillas, 20 count | 3.70 | 2",
        corrected_name: null,
      },
      true,
    );
    expect(recovered.correctedName).toBe("Fajita Tortillas, 20 count");
  });

  it("does not let enrichment overwrite a pasted or edited name", () => {
    const pasted = resolvePastedDisplayDescription({
      correctedName: "French Green Beans",
      sourceText: "French Green Beans | 5.98 | 2",
      descriptionSource: "enrichment_suggestion",
    });
    expect(pasted).toBe("French Green Beans");
    const edited = resolvePastedDisplayDescription({
      correctedName: "Ground Beef",
      sourceText: "GRND BF | 16.10 | 1",
      descriptionEditedByUser: true,
      descriptionSource: "manually_edited",
    });
    expect(edited).toBe("Ground Beef");
  });

  it("keeps commas, fractions, and counts in pasted names", () => {
    expect(displayDescriptionFromPastedSource("Fajita Tortillas, 20 count | 3.70 | 2")).toBe(
      "Fajita Tortillas, 20 count",
    );
    expect(displayDescriptionFromPastedSource("85/15 Ground Beef | 16.10 | 1")).toBe(
      "85/15 Ground Beef",
    );
    const fields = pastedLinePersistenceFields({
      description: "Yellow Onions",
      raw: "Yellow Onions | 2.39 | 1",
    });
    expect(fields.name).toBe("Yellow Onions");
    expect(fields.sourceText).toBe("Yellow Onions | 2.39 | 1");
  });

  it("preserves corrected ALDI names through parse → extraction → review", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20_CORRECTED);
    const extraction = pastedReceiptToExtraction(parsed.receipt!);
    expect(extraction.lineItems.slice(0, 3).map((l) => l.displayDescription)).toEqual([
      "85/15 Ground Beef",
      "French-Style Green Beans",
      "Yellow Onions, 3 lb Bag",
    ]);
  });

  it("preserves Walmart trash-can names through the same mapping", () => {
    const initial = pastedReceiptToExtraction(
      parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART_TRASH).receipt!,
    );
    const corrected = pastedReceiptToExtraction(
      parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART_TRASH_CORRECTED).receipt!,
    );
    expect(initial.lineItems.map((l) => l.name)).toEqual([
      "Mainstays 13.2-Gallon Step Trash Can",
      "Great Value 14.5-Gallon Trash Bags",
    ]);
    expect(corrected.lineItems.map((l) => l.name)).toEqual([
      "Mainstays 13.2-Gallon Step Trash Can, Black",
      "Great Value 14.5-Gallon Trash Bags, 20 Count",
    ]);
  });
});
