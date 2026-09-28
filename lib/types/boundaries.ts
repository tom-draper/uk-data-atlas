import { BoundaryGeojson } from "./geometry";
import type { BoundaryType as CatalogBoundaryType } from "../data/boundaries/catalog";

export type BoundaryType = CatalogBoundaryType;

export type BoundaryData = Record<
	BoundaryType,
	Record<number, BoundaryGeojson | null>
>;

/**
 * The ward codes present in each loaded ward vintage, keyed by boundary year,
 * or null while the boundaries are still loading.
 */
export type WardCodes = Record<number, Set<string>> | null;
