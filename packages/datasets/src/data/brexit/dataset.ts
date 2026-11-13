import type { BrexitLADDataset } from "../../types/referendum.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { ANSWER, REFERENDUM, referendumDay } from "./referendum.ts";
import { loadBrexit } from "./loader.ts";

export const brexit = defineDataset<BrexitLADDataset>({
	id: "brexit",
	topic: "referendums",
	boundary: { type: "localAuthority", year: 2016 },
	source: {
		name: "EU Referendum Results",
		publisher: "Electoral Commission",
		sourceUrl:
			"https://www.electoralcommission.org.uk/research-reports-and-data/our-reports-and-data-past-elections-and-referendums/results-and-turnout-eu-referendum",
		year: "2016",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Electoral Commission. Contains public sector information licensed under the Open Government Licence v3.0.",
		description: "EU referendum results by local authority counting area.",
		cadence: "discontinued",
		notes: [],
	},
	load: async ({ text }) => loadBrexit(text),
	statistics: {
		payload: {
			parts: yearParts("brexit", "localAuthority", 2016, {}, ["2016"]),
			code: "ladCode",
			/** The answer with more votes in each area. */
			summary: (records) => ({
				results: Object.fromEntries(
					Object.entries(records).map(([code, record]) => {
						const { leave, remain } = record as {
							leave: number;
							remain: number;
						};
						return [
							code,
							leave > remain
								? "leave"
								: remain > leave
									? "remain"
									: null,
						];
					}),
				),
			}),
		},
		name: "ladName",
		parents: [
			{
				code: "regionCode",
				name: "regionName",
				release: { geography: "region", year: 2025 },
				alsoIn: [{ geography: "country", year: 2025 }],
			},
		],
		period: referendumDay,
		alsoIn: [{ geography: "country", year: 2020 }],
		measures: REFERENDUM,
		dimensions: [ANSWER],
		fields: [
			{ path: "electorate", measure: "electorate" },
			{ path: "validVotes", measure: "valid-votes" },
			{ path: "rejectedBallots", measure: "rejected-ballots" },
			{ path: "pctTurnout", measure: "turnout" },
			...(["remain", "leave"] as const).flatMap((answer) => [
				{
					path: answer,
					measure: "referendum-votes",
					members: { "referendum-answer": answer },
				},
				{
					path: `pct${answer[0].toUpperCase()}${answer.slice(1)}`,
					measure: "referendum-vote-share",
					members: { "referendum-answer": answer },
				},
			]),
		],
	},
});
