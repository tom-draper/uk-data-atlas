import type { BrexitConstituencyDataset } from "../../types/referendum.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { ANSWER, REFERENDUM, referendumDay } from "../brexit/referendum.ts";
import { loadBrexitConstituency } from "./loader.ts";

export const brexitConstituency = defineDataset<BrexitConstituencyDataset>({
	id: "brexit-constituency",
	topic: "referendums",
	boundary: { type: "constituency", year: 2015 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "EU Referendum Results (Constituency Estimates)",
		publisher:
			"Hanretty, C. (2017). Areal interpolation and the UK's referendum on EU membership. Journal of Elections, Public Opinion and Parties, 27(4), 466-483.",
		sourceUrl:
			"https://commonslibrary.parliament.uk/brexit-votes-by-constituency/",
		year: "2016",
		licence: "Open Parliament Licence",
		licenceUrl:
			"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
		attribution:
			"Hanretty, C. (2017), via the House of Commons Library. Licensed under the Open Parliament Licence.",
		description:
			"EU referendum result estimates by Westminster parliamentary constituency.",
		cadence: "discontinued",
		notes: [],
	},
	load: async ({ xlsxSheet }) =>
		loadBrexitConstituency((path) => xlsxSheet(path, "DATA")),
	statistics: {
		payload: {
			parts: yearParts(
				"brexit-constituency",
				"constituency",
				2015,
				{ coverageCountries: ["GB-ENG"] },
				["2016"],
			),
			code: "constituencyCode",
			/** Leave where more than half voted to leave. */
			summary: (records) => ({
				results: Object.fromEntries(
					Object.entries(records).map(([code, record]) => {
						const { pctLeave } = record as { pctLeave: number };
						return [
							code,
							pctLeave > 50
								? "leave"
								: pctLeave < 50
									? "remain"
									: null,
						];
					}),
				),
			}),
		},
		name: "constituencyName",
		period: referendumDay,
		measures: REFERENDUM,
		dimensions: [ANSWER],
		fields: [
			{
				path: "pctLeave",
				measure: "referendum-vote-share",
				members: { "referendum-answer": "leave" },
				status: {
					path: "isKnownResult",
					values: { observed: true, estimated: false },
				},
			},
		],
	},
});
