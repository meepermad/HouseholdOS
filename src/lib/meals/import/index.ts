export {
  RECIPE_IMPORT_PARSER_VERSION,
  EXTRACTION_STRATEGIES,
  IMPORT_CONFIDENCE_LEVELS,
  IMPORT_WARNING_CODES,
} from "./types";
export type {
  ExtractionStrategy,
  ImportConfidenceLevel,
  ImportWarningCode,
  ImportValidationWarning,
  FieldConfidence,
  ParsedIngredient,
  ParsedInstructionStep,
  ParsedDuration,
  ParsedYield,
  ExtractedRecipeCandidate,
  RawExtractedRecipe,
  ExtractorHit,
  ConfidenceSummary,
  RecipeImportPipelineInput,
  RecipeImportPipelineResult,
  ExistingRecipeDuplicateProbe,
  DuplicateMatchKind,
  DuplicateMatch,
  DuplicateDetectionResult,
} from "./types";

export { stripHtml, stripHtmlList } from "./sanitize-html";
export { parseDuration, durationConflictWarning } from "./parse-duration";
export { parseYield } from "./parse-yield";
export {
  parseIngredientLine,
  parseIngredientLines,
} from "./parse-ingredient";
export {
  parseInstructions,
  inferPhase,
  instructionsConfidence,
} from "./parse-instructions";
export {
  COPYRIGHT_SAFE_RECIPE_FIELDS,
  filterCopyrightFields,
} from "./copyright-filter";
export {
  normalizeCanonicalUrl,
  hostnameFromUrl,
  computeContentHash,
  detectDuplicates,
  jaccardSimilarity,
} from "./duplicates";
export { extractJsonLd } from "./extractors/json-ld";
export { extractMicrodata } from "./extractors/microdata";
export { extractHtmlFallback } from "./extractors/html-fallback";
export {
  runRecipeImportPipeline,
  normalizeExtractorHit,
  normalizeRawRecipe,
} from "./pipeline";
export {
  candidateToReviewPayload,
  warningMessages,
} from "./to-review-payload";
export type { ReviewRecipePayload } from "./to-review-payload";
export {
  redactUrlForLog,
  redactUrlsInText,
  safeHostnameForLog,
} from "./log-redaction";
