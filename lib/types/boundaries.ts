import { BoundaryGeojson } from "./geometry";
import type { BoundaryType as CatalogBoundaryType } from "../data/boundaries/catalog";

export type BoundaryType = CatalogBoundaryType;

export type BoundaryData = Record<
	BoundaryType,
	Record<number, BoundaryGeojson | null>
>;

export type BoundaryCodes = Record<
	BoundaryType,
	Record<number, Set<string>>
> | null;
