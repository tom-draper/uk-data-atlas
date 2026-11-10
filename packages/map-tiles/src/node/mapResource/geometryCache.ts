import type { GeoJsonGeometry } from "@uk-data-atlas/geography";
import type { PackedGeometry } from "@uk-data-atlas/geography";

/** Geometry access needed to build map downloads. */
export type MapGeometryCache = {
	codes(geography: string, boundaryRelease: string): string[];
	get(
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeoJsonGeometry | undefined;
	packed(
		geography: string,
		boundaryRelease: string,
		code: string,
	): PackedGeometry | undefined;
	provenance(
		geography: string,
		boundaryRelease: string,
	): { inputHash?: string };
};
