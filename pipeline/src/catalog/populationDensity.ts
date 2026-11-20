import type { CatalogueRows } from "./rows.ts";
import type {
	Measure,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";
import { sha256 } from "./values.ts";
import { measureSeriesKey } from "@uk-data-atlas/measures";

/**
 * Population density, the first measure derived from two others.
 *
 * Built here rather than at request time so the compatibility the roadmap
 * gates this on is checked once, loudly, at build: the denominator's code
 * set must match the population's exactly, and no area may have zero land.
 * A mismatch throws rather than publishing a plausible-looking figure.
 */
export const compilePopulationDensity = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
	localAuthorityPeriods: MeasureObservationArtifact["periods"],
): CompiledMeasure => {
	const seriesKey = measureSeriesKey({ measure: "population-density" });
	const landArea = datasets.find((dataset) => dataset.id === "land-area");
	if (!landArea) throw new Error(`${manifestPath} has no land-area dataset`);
	const densityPeriods = rows.periods(
		{
			series: { measure: "population-density" },
			datasetId: "population-uk",
			geography: "localAuthority",
			boundaryYear: 2023,
		},
		localAuthorityPeriods.map(({ period }) => period),
	);
	// The quotient leaves out an area its land area does not cover, so every
	// area and period the population publishes must come back.
	for (const { period, records } of localAuthorityPeriods) {
		const density = densityPeriods.find((entry) => entry.period === period);
		const missing = records.find(
			(record) =>
				!density?.records.some(
					(entry) => entry.areaCode === record.areaCode,
				),
		);
		if (missing)
			throw new Error(
				`land-area: no density for ${missing.areaCode} in ${period}, which the population partition publishes`,
			);
		if (density && density.records.length !== records.length)
			throw new Error(
				`land-area: ${density.records.length - records.length} areas have a density but no population in ${period}, so the two partitions are not the same code set`,
			);
	}
	const densityContent = JSON.stringify({
		schemaVersion: 1,
		measureId: seriesKey,
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: densityPeriods,
	});
	const densityMeasure: Measure = {
		id: "population-density",
		label: "Population density",
		valueKind: "ratio",
		unit: "people per square kilometre",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's land area in square kilometres, which is this measure's denominator.",
				datasetField: "landSquareKm",
			},
			available: false,
		},
		sources: [
			{
				datasetId: "population-uk",
				periods: densityPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "source-reported",
					countries: countriesFor(densityPeriods[0]?.records ?? []),
					recordCount: densityPeriods[0]?.records.length ?? 0,
					note: "Derived for every area and period the population partition publishes; the denominator covers exactly the same code set.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/population-density" },
		derivedFrom: {
			datasetIds: ["population-uk", "land-area"],
			note: "Mid-year population divided by Standard Area Measurement land area. Both inputs must be attributed when this measure is used.",
		},
		notes: [
			"Derived: mid-year population divided by land area. It is not a source observation, and no publisher is responsible for the quotient.",
			"The denominator is the ONS Standard Area Measurement land area, which excludes inland water. The extent of the realm is larger and would give a lower figure; it is published in the land-area dataset but deliberately not used here.",
			"The population is published on the 2023 local-authority code vintage and the land area on the December 2024 vintage. The two code sets were verified identical when this was compiled, so no conversion was applied.",
			"Density is a ratio, so it does not add over areas. Combining authorities needs a land-area weighted mean, which is the same as recomputing it from the summed population and summed land area.",
		],
	};
	return {
		measure: densityMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(densityContent),
			measureId: seriesKey,
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: densityPeriods,
		},
	};
};
