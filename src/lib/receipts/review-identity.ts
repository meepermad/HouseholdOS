/**
 * Client identity for receipt review. Must stay stable across line
 * assignment mutations. Including claims or classifications here remounts
 * the form and closes the assignment UI after every change.
 */
export function receiptReviewFormKey(receiptId: string): string {
  return receiptId;
}
