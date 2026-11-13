import type { NIMDMDataset } from "../../types/nimdm.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { summariseNIMDM } from "../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../deprivation/declaration.ts";
import { loadNIMDM } from "./loader.ts";

export const nimdm = defineDataset<NIMDMDataset>({
	id: "nimdm",
	topic: "deprivation",
	boundary: { type: "superOutputArea", year: 2011 },
	source: {
		name: "Northern Ireland Multiple Deprivation Measure",
		publisher: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/statistics/deprivation/northern-ireland-multiple-deprivation-measure-2017-nimdm2017",
		year: "2017",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Northern Ireland Statistics and Research Agency. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Deprivation scores, ranks and deciles by super output area for Northern Ireland.",
		cadence: "irregular",
		notes: [],
	},
	load: ({ text }) => loadNIMDM(text),
	statistics: deprivationStatistics({
		id: "nimdm",
		prefix: "nimdm",
		index: "Northern Ireland Multiple Deprivation Measure",
		area: "super output areas in Northern Ireland",
		fields: {},
		boundary: { type: "superOutputArea", year: 2011 },
		edition: "2017",
		metadata: {
			source: "Northern Ireland Statistics and Research Agency. Northern Ireland Multiple Deprivation Measure 2017.",
			notes: [
				"Northern Ireland only. NISRA publishes ranks, not deciles, for Super Output Areas; rank 1 is the most deprived.",
			],
		},
		code: "soaCode",
		name: "soaName",
		parent: { code: "lgdCode", name: "lgdName" },
		summaryField: "lgdStats",
		// The most deprived tenth of the 890 areas.
		mostDeprived: (record) => (record.nimdmRank as number) <= 89,
	}),
	display: rankDisplay({
		prefix: "nimdm",
		label: "Deprivation (NIMDM) [2017]",
		year: 2017,
		areaCount: 890,
		aggregation: {
			scope: "superOutputArea",
			distinct: true,
			aggregate: summariseNIMDM,
		},
	}),
});
