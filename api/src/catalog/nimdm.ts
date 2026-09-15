import type { Measure } from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

/**
 * The Northern Ireland Multiple Deprivation Measure 2017, as its published
 * rank. NISRA publishes ranks for super output areas but not deciles; the
 * deciles the website shows are its own division of the ranks, so they are
 * not published here.
 */
export const compileNimdm = (
	{ manifestPath, datasets }: CatalogManifest,
	nimdmPath: string,
): CompiledMeasure => {
	const nimdm = datasets.find((dataset) => dataset.id === "nimdm");
	if (!nimdm) throw new Error(`${manifestPath} has no nimdm dataset`);
	const nimdmPeriods = localAuthorityFieldPeriods(
		nimdmPath,
		"nimdmRank",
		2011,
		"superOutputArea",
	);
	const nimdmContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "nimdm-rank",
		sourceGeography: { type: "superOutputArea", boundaryYear: 2011 },
		periods: nimdmPeriods,
	});
	const nimdmMeasure: Measure = {
		id: "nimdm-rank",
		label: "Northern Ireland Multiple Deprivation Measure rank",
		valueKind: "ordinal",
		unit: "rank of 890 super output areas, where 1 is the most deprived",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "rank",
			note: "A rank records an order, not a distance. Averaging ranks over areas produces a number with no meaning.",
			available: false,
		},
		sources: [
			{
				datasetId: "nimdm",
				periods: nimdmPeriods.map((period) => period.period),
				sourceGeography: {
					type: "superOutputArea",
					boundaryYear: 2011,
				},
				coverage: {
					kind: "partial",
					countries: countriesFor(nimdmPeriods[0]?.records ?? []),
					recordCount: nimdmPeriods[0]?.records.length ?? 0,
					note: "Northern Ireland only. The other three nations publish their own indices, which are not comparable with this one.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/nimdm-rank" },
		notes: [
			"A position within Northern Ireland alone. The English, Welsh and Scottish indices use different methods, domains and dates, so a rank cannot be compared across nations.",
			"The publisher labels these areas SOA2001. Super output areas were drawn for the 2001 census and reused unchanged for 2011, and every code matches the 2011 release.",
			"NISRA publishes ranks, not deciles, for super output areas, so no decile measure is offered.",
		],
	};
	return {
		measure: nimdmMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(nimdmContent),
			measureId: "nimdm-rank",
			sourceGeography: { type: "superOutputArea", boundaryYear: 2011 },
			periods: nimdmPeriods,
		},
	};
};
