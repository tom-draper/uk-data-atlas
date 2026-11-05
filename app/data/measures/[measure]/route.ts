import { measureValuesHandler } from "@/lib/measures/handler";

export const runtime = "nodejs";

/**
 * Values of one measure for a set of areas and periods, as columns. See
 * `docs/website-measure-queries.md`.
 */
export const GET = measureValuesHandler;
