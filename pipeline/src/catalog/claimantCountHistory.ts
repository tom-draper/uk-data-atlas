import type { Measure, MeasureSource } from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import {
	measureSeriesKey,
	type MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";
import type { CatalogueRows } from "./rows.ts";
import { sha256 } from "./values.ts";

const DATASET_ID = "claimant-count-history";
const SOURCE_GEOGRAPHY = {
	type: "localAuthority" as const,
	boundaryYear: 2023,
};

const NOTES = [
	"Every month from January 2013, restated by the publisher on the authorities of April 2023, so the series has no break where authorities were reorganised.",
	"People claiming Universal Credit or Jobseeker's Allowance principally for the reason of being unemployed. It counts claimants, not unemployment.",
];

/**
 * The monthly Claimant Count history, one partition over every month it
 * holds. The count joins the single month's `claimant-count` measure as a
 * further source; the rate is published only here.
 */
export const compileClaimantCountHistory = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
): CompiledMeasure[] => {
	const dataset = datasets.find((candidate) => candidate.id === DATASET_ID);
	if (!dataset)
		throw new Error(`${manifestPath} has no ${DATASET_ID} dataset`);
	if (!dataset.summary.boundaryYears.includes(SOURCE_GEOGRAPHY.boundaryYear))
		throw new Error(
			`${manifestPath}: ${DATASET_ID} must declare boundary year ${SOURCE_GEOGRAPHY.boundaryYear}`,
		);
	const specs: Array<
		Pick<Measure, "id" | "label" | "valueKind" | "unit" | "aggregation"> & {
			series: MeasureSeriesIdentity;
			note: string;
			coverage: string;
		}
	> = [
		{
			id: "claimant-count",
			series: {
				measure: "claimants",
				dimensions: { "age-group": "16-plus" },
			},
			label: "Claimant count",
			valueKind: "count",
			unit: "claimants aged 16 and over",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			note: "Counts are rounded by the publisher to the nearest five, so a sum over areas carries that rounding from every member.",
			coverage:
				"Every local authority of April 2023 in all four UK nations, for every month from January 2013.",
		},
		{
			id: "claimant-rate",
			series: { measure: "claimant-rate" },
			label: "Claimants as a share of residents aged 16 to 64",
			valueKind: "ratio",
			unit: "% of residents aged 16 to 64",
			aggregation: {
				kind: "intensive",
				operation: "weighted-mean",
				weight: {
					description:
						"Residents aged 16 to 64, which the publisher does not state but which is the count divided by the rate.",
					datasetField: "claimants / claimant-rate",
				},
				available: false,
			},
			note: "The publisher suppresses the proportion where the count is 1 or 2, so the Isles of Scilly has no value in eight months. A rate does not add over areas.",
			coverage:
				"Every local authority of April 2023 in all four UK nations, for every month from January 2013, less the months a proportion is suppressed.",
		},
	];
	return specs.map(({ note, coverage, ...spec }) => {
		const periods = rows
			.periods({
				series: spec.series,
				datasetId: DATASET_ID,
				geography: SOURCE_GEOGRAPHY.type,
				boundaryYear: SOURCE_GEOGRAPHY.boundaryYear,
			})
			.filter((period) => period.records.length > 0);
		if (periods.length === 0)
			throw new Error(`${DATASET_ID} has no ${spec.id} records`);
		const seriesKey = measureSeriesKey(spec.series);
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: seriesKey,
			sourceGeography: SOURCE_GEOGRAPHY,
			periods,
		});
		const latest = periods.at(-1)!;
		const source: MeasureSource = {
			datasetId: DATASET_ID,
			observationArtifact: `${spec.id}-history-observations`,
			periods: periods.map((period) => period.period),
			sourceGeography: SOURCE_GEOGRAPHY,
			coverage: {
				kind: "source-reported",
				countries: countriesFor(latest.records),
				recordCount: latest.records.length,
				note: coverage,
			},
		};
		return {
			measure: {
				...spec,
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: spec.aggregation.available,
				},
				links: { data: `/v1/data/${spec.id}` },
				notes: [note, ...NOTES],
			},
			artifact: {
				schemaVersion: 1,
				contentHash: sha256(content),
				measureId: seriesKey,
				sourceGeography: SOURCE_GEOGRAPHY,
				periods,
			},
		};
	});
};
