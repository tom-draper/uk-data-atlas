import type { WIMDDataset } from "../../types/wimd.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { summariseWIMD } from "../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../deprivation/declaration.ts";
import { loadWIMD } from "./loader.ts";

export const wimd = defineDataset<WIMDDataset>({
	id: "wimd",
	topic: "deprivation",
	boundary: { type: "lsoa", year: 2011 },
	source: {
		name: "Welsh Index of Multiple Deprivation",
		publisher: "Welsh Government",
		sourceUrl: "https://www.gov.wales/welsh-index-multiple-deprivation",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Welsh Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Deprivation scores, ranks and deciles by lower super output area for Wales.",
		cadence: "irregular",
		notes: [],
	},
	load: async ({ text, odsContent }) =>
		loadWIMD(
			text,
			await odsContent(
				sourceDir(
					"wimd",
					"welsh-index-multiple-deprivation-2019-index-and-domain-ranks-by-small-area.ods",
				),
			),
		),
	statistics: deprivationStatistics({
		id: "wimd",
		prefix: "wimd",
		index: "Welsh Index of Multiple Deprivation",
		area: "LSOAs in Wales",
		fields: { score: true, decile: true, population: true },
		boundary: { type: "lsoa", year: 2011 },
		edition: "2019",
		metadata: {
			source: "Welsh Government. Welsh Index of Multiple Deprivation 2019.",
			notes: ["Wales only. Decile 1 = most deprived 10% of LSOAs."],
		},
		code: "lsoaCode",
		name: "lsoaName",
		parent: { code: "ladCode", name: "ladName" },
		summaryField: "ladStats",
		mostDeprived: (record) => record.wimdDecile === 1,
		weighted: { score: "wimdScore" },
	}),
	display: rankDisplay({
		prefix: "wimd",
		label: "Deprivation (WIMD) [2019]",
		year: 2019,
		areaCount: 1909,
		aggregation: {
			scope: "lsoa",
			distinct: true,
			aggregate: summariseWIMD,
		},
	}),
});
