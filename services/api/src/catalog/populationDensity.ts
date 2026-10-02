import type {
	Measure,
	PopulationLocalAuthorityObservationArtifact,
} from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

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
	landAreaPath: string,
	localAuthorityPeriods: PopulationLocalAuthorityObservationArtifact["periods"],
): CompiledMeasure => {
	const landArea = datasets.find((dataset) => dataset.id === "land-area");
	if (!landArea) throw new Error(`${manifestPath} has no land-area dataset`);
	const landAreaByCode = new Map(
		localAuthorityFieldPeriods(
			landAreaPath,
			"landSquareKm",
			2024,
		)[0]?.records.map((record) => [record.areaCode, record.value]) ?? [],
	);
	if (landAreaByCode.size === 0)
		throw new Error(`${landAreaPath} has no land area records`);
	const densityPeriods = localAuthorityPeriods.map((period) => ({
		period: period.period,
		records: period.records.map((record) => {
			const squareKm = landAreaByCode.get(record.areaCode);
			if (squareKm === undefined) {
				throw new Error(
					`${landAreaPath}: no land area for ${record.areaCode}, which the population partition publishes`,
				);
			}
			if (squareKm <= 0) {
				throw new Error(
					`${landAreaPath}: ${record.areaCode} has no land area, so its density is undefined`,
				);
			}
			return {
				areaCode: record.areaCode,
				value: record.value / squareKm,
				status: "derived" as const,
			};
		}),
	}));
	const unusedLandArea = [...landAreaByCode.keys()].filter(
		(code) =>
			!localAuthorityPeriods[0]?.records.some(
				(record) => record.areaCode === code,
			),
	);
	if (unusedLandArea.length > 0) {
		throw new Error(
			`${landAreaPath}: ${unusedLandArea.length} areas have a land area but no population, so the two partitions are not the same code set`,
		);
	}
	const densityContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "population-density",
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
			measureId: "population-density",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: densityPeriods,
		},
	};
};
