import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import { getProp } from "@/lib/data/boundaries/properties";
import type { BoundaryGeojson, BoundaryType, Dataset } from "@/lib/types";

const COUNTRY_PREFIXES = {
	"GB-ENG": "E",
	"GB-SCT": "S",
	"GB-WLS": "W",
	"GB-NIR": "N",
} as const;

/**
 * Remove boundaries outside a dataset's published geographic scope.
 *
 * Record keys are deliberately not used: an in-scope ward can have no election
 * in a particular year and should remain visible, just uncoloured.
 */
export const filterGeometryToDatasetCoverage = (
	geojson: BoundaryGeojson,
	dataset: Dataset & { boundaryType: BoundaryType },
): BoundaryGeojson => {
	const coverage = dataset.coverageCountries;
	if (!coverage?.length) return geojson;

	const prefixes = coverage.map((country) => COUNTRY_PREFIXES[country]);
	const codeKeys = BOUNDARY_CATALOG[dataset.boundaryType].properties.code;
	const filtered = geojson.features.filter((feature) => {
		const code = getProp(feature.properties, codeKeys);
		return !!code && prefixes.some((prefix) => code.startsWith(prefix));
	});

	return filtered.length === geojson.features.length
		? geojson
		: { ...geojson, features: filtered };
};
