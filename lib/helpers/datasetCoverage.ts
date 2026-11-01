import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import {
	getProp,
	countryPrefixForBoundaryCode,
} from "@uk-data-atlas/datasets/data/boundaries/properties";
import type {
	BoundaryGeojson,
	BoundaryType,
	Dataset,
	DatasetCountry,
	DatasetCoverage,
} from "@/lib/types";

const COUNTRY_PREFIXES = {
	"GB-ENG": "E",
	"GB-SCT": "S",
	"GB-WLS": "W",
	"GB-NIR": "N",
} as const;

const COUNTRY_NAMES = {
	"GB-ENG": "England",
	"GB-WLS": "Wales",
	"GB-SCT": "Scotland",
	"GB-NIR": "Northern Ireland",
} as const satisfies Record<DatasetCountry, string>;

export function formatDatasetCoverage(
	dataset: (DatasetCoverage & { type: string }) | null | undefined,
): string | undefined {
	const countries = (Object.keys(COUNTRY_NAMES) as DatasetCountry[]).filter(
		(country) => dataset?.coverageCountries?.includes(country),
	);
	if (countries.length === 4) return "United Kingdom";
	if (countries.length === 3 && !countries.includes("GB-NIR")) {
		return "Great Britain";
	}
	const names = countries.map((country) => COUNTRY_NAMES[country]);
	if (names.length === 0) return undefined;
	if (names.length === 1) return names[0];
	return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

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
		return (
			!!code &&
			prefixes.some(
				(prefix) =>
					countryPrefixForBoundaryCode(dataset.boundaryType, code) ===
					prefix,
			)
		);
	});

	return filtered.length === geojson.features.length
		? geojson
		: { ...geojson, features: filtered };
};
