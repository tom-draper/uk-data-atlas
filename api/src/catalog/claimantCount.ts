import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/** The claimant count by local authority, on the April 2023 authorities. */
export const compileClaimantCount = (
	manifest: CatalogManifest,
	claimantCountPath: string,
	populationCodes: Set<string>,
): CompiledMeasure[] => {
	const claimants = (
		id: string,
		label: string,
		field: string,
		unit: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "count",
		unit,
		aggregation: { kind: "extensive", operation: "sum", available: true },
		notes: [note],
	});
	return publishIndicators(manifest, {
		datasetId: "claimant-count",
		path: claimantCountPath,
		boundaryYear: 2024,
		period: "2026-04",
		expectedCodes: [...populationCodes],
		mergeApril2023: true,
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		notes: [
			"People claiming Universal Credit or Jobseeker's Allowance principally for the reason of being unemployed, in April 2026. It counts claimants, not unemployment: the survey measure of unemployment includes people who claim nothing and excludes some who do.",
			"Counts are rounded by the publisher to the nearest five, so a sum over areas carries that rounding from every member.",
			"The published rates, claimants as a share of residents aged 16 to 64, are not served: a rate does not add over areas and would need the working-age population as a weight.",
			"The compiled dataset holds the four authorities created in April 2023 beside the districts they replaced; the districts are dropped after checking each authority is their exact sum, so no claimant is counted twice.",
		],
		indicators: [
			claimants(
				"claimant-count",
				"Claimant count",
				"totalCount",
				"claimants aged 16 and over",
				"Every claimant aged 16 and over.",
			),
			claimants(
				"claimant-count-16-to-24",
				"Claimant count aged 16 to 24",
				"youthCount",
				"claimants aged 16 to 24",
				"Claimants aged 16 to 24, a subset of the claimant count.",
			),
		],
	});
};
