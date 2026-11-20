import type { CatalogueRows } from "./rows.ts";
import type {
	Measure,
	MeasureObservationArtifact,
	MeasureSource,
	SourceGeography,
} from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import type { CatalogManifest } from "./manifest.ts";
import { sha256 } from "./values.ts";
import { measureSeriesKey } from "@uk-data-atlas/measures";

/**
 * Regional economic output on the three ITL tiers.
 *
 * The publisher restates the whole 1998 series on current codes with every
 * release, so all three tiers are on the January 2025 vintage. That vintage
 * renumbers much of the 2021 tier — Tees Valley moves from TLC1 to TLC3 — so
 * these partitions are offered on the 2025 releases only, and a caller asking
 * for a 2021 release is refused rather than joined to a code that means a
 * different area.
 *
 * The tiers are one dataset with the tier as its geography. Each is its own
 * source partition, never mixed into one total: the tiers nest, so summing
 * across them would count the same output three times.
 */
const DATASET = "regional-gdp";

const TIERS = [
	{ geography: "itl1" },
	{ geography: "itl2" },
	{ geography: "itl3" },
] as const;

const MEASURES = [
	{
		id: "gva",
		label: "Gross value added",
		note: "Balanced gross value added at current basic prices: the output of an area before taxes on products are added and subsidies taken off. It is not comparable with the national GDP figure; use gdp for that.",
	},
	{
		id: "gdp",
		label: "Gross domestic product",
		note: "Gross domestic product at current market prices: balanced gross value added plus taxes on products less subsidies on them, allocated to areas by the publisher. This is the regional figure comparable with the national accounts.",
	},
] as const;

const SHARED_NOTES = [
	"Values are in cash terms for the year observed, not adjusted for inflation, so a rise between two periods is not a rise in real output.",
	"The three ITL tiers nest, so an ITL3 area sits inside an ITL2 area inside an ITL1 area. Each tier is a separate source partition; areas may be summed within one tier, never across tiers.",
	"Output per head is not served. It is a ratio, so it cannot be summed over areas, and the publisher's population basis for it is the regional accounts one rather than the mid-year estimates this API serves.",
	"Output is measured where it is produced, not where the people who earn it live, so an area that many commute into records output they do not live beside.",
];

export const compileRegionalGdp = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
): { measures: Measure[]; artifacts: MeasureObservationArtifact[] } => {
	const measures: Measure[] = [];
	const artifacts: MeasureObservationArtifact[] = [];
	const dataset = datasets.find((candidate) => candidate.id === DATASET);
	if (!dataset) throw new Error(`${manifestPath} has no ${DATASET} dataset`);

	for (const spec of MEASURES) {
		const seriesKey = measureSeriesKey({ measure: spec.id });
		const sources: MeasureSource[] = [];
		let tierRecords = 0;
		for (const tier of TIERS) {
			const sourceGeography: SourceGeography = {
				type: tier.geography,
				boundaryYear: 2025,
			};
			const periods = rows.periods({
				series: { measure: spec.id },
				datasetId: DATASET,
				geography: tier.geography,
				boundaryYear: 2025,
			});
			// The publisher restates every year on one code vintage, so each
			// period must hold the same areas. A year short of one would
			// otherwise sum to a smaller total that reads as a fall in output.
			const [first, ...rest] = periods;
			const expected = (first?.records ?? [])
				.map((record) => record.areaCode)
				.join(",");
			for (const period of rest) {
				const actual = period.records
					.map((record) => record.areaCode)
					.join(",");
				if (actual !== expected) {
					throw new Error(
						`${DATASET}.${period.period}: holds different ${tier.geography} areas from ${first?.period}, but the series is restated on one vintage`,
					);
				}
			}
			tierRecords += periods.reduce(
				(total, period) => total + period.records.length,
				0,
			);
			sources.push({
				datasetId: DATASET,
				periods: periods.map((period) => period.period),
				sourceGeography,
				// Three tiers of one measure, so each needs its own artifact
				// filename; the default stem is the measure id alone and the
				// three would overwrite each other.
				observationArtifact: `${spec.id}-${tier.geography}-observations`,
				coverage: {
					kind: "source-reported",
					countries: countriesFor(periods[0]?.records ?? []),
					recordCount: periods[0]?.records.length ?? 0,
					note: `Published source records cover all four UK nations for every period, as ${periods[0]?.records.length ?? 0} ${tier.geography} areas on one restated code vintage.`,
				},
			});
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId: seriesKey,
				sourceGeography,
				periods,
			});
			artifacts.push({
				schemaVersion: 1,
				contentHash: sha256(content),
				measureId: seriesKey,
				sourceGeography,
				periods,
			});
		}
		if (tierRecords !== dataset.summary.dataRecordCount) {
			throw new Error(
				`${DATASET}: expected ${dataset.summary.dataRecordCount} records from the manifest, found ${tierRecords}`,
			);
		}
		measures.push({
			id: spec.id,
			label: spec.label,
			valueKind: "quantity",
			unit: "£ million",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			sources,
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			links: { data: `/v1/data/${spec.id}` },
			notes: [spec.note, ...SHARED_NOTES],
		});
	}

	return { measures, artifacts };
};
