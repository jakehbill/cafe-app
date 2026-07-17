/**
 * Beaned review model version.
 *
 * Bump when the stored review shape or Work Score meaning changes so clients
 * and migrations can branch cleanly.
 *
 * | Version | Meaning |
 * |---------|---------|
 * | 1 | Legacy café coffee ratings (1–5), pre–workspace model |
 * | 2 | Workspace review model (Sprint 4+): 1–10 Work Score + stay/cost/tags/etc. |
 */
export const REVIEW_SCHEMA_VERSION = 2 as const;

export type ReviewSchemaVersion = typeof REVIEW_SCHEMA_VERSION;
