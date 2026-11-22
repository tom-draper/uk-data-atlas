import type { ClaimantCountHistoryDataset } from "../../../types/claimantCount.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import {
	CLAIMANT_AGE_GROUP,
	CLAIMANT_RATE,
	CLAIMANTS,
} from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { claimantCountHistoryStatisticsParts } from "../../../data/claimant-count-history/source.ts";

export const claimantCountHistory = defineDataset<ClaimantCountHistoryDataset>({
	id: "claimant-count-history",
	topic: "labour-market",
	guide: {
		title: "Claimant Count (monthly history)",
		about: "The share of working-age residents claiming unemployment-related benefits, Universal Credit or Jobseeker's Allowance, in each local authority, every month from January 2013. It is the monthly trend behind the single month the Claimant Count shows.",
		summary:
			"Monthly claimants of Universal Credit or Jobseeker's Allowance in each local authority, January 2013 to October 2026, as a count and as a share of residents aged 16 to 64.",
	},
	source: {
		name: "Claimant Count (monthly history)",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.nomisweb.co.uk/datasets/ucjsa",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Claimants of Universal Credit and Jobseeker's Allowance by local authority for the United Kingdom, every month from January 2013 to October 2026, all ages and both sexes, on the authorities of April 2023.",
		year: "2013-2026",
		cadence: "monthly",
		notes: [
			"People claiming Universal Credit or Jobseeker's Allowance principally for the reason of being unemployed. It counts claimants, not unemployment.",
			"Counts are rounded by the publisher to the nearest five, so a sum over areas carries that rounding from every member.",
			"Every month is on the authorities of April 2023, restated by the publisher, so the series has no break where authorities were reorganised.",
			"The proportion is left out where the publisher suppresses it because the count is 1 or 2: the Isles of Scilly in eight months.",
			"Only the total for all ages is held. The age breakdown is in the April 2026 Claimant Count.",
			"The April 2026 figures here are from the restated series and can differ slightly from those of the Claimant Count dataset.",
		],
	},
	boundary: { type: "localAuthority", year: 2023 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	chartPending: true,
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => claimantCountHistoryStatisticsParts(text),
		},
		payload: {
			parts: (labels) =>
				labels
					.filter((label) => /^\d{4}-\d{2}$/.test(label))
					.sort()
					.map((key) => ({
						key,
						header: {
							id: `claimant-count-history${key}`,
							type: "claimant-count-history",
							year: Number(key.slice(0, 4)),
							boundaryType: "localAuthority",
							boundaryYear: 2023,
						},
					})),
			code: "ladCode",
		},
		name: "ladName",
		period: (key) =>
			periods.month(Number(key.slice(0, 4)), Number(key.slice(5, 7))),
		measures: [CLAIMANTS, CLAIMANT_RATE],
		dimensions: [CLAIMANT_AGE_GROUP],
		fields: [
			{
				path: "totalCount",
				measure: "claimants",
				members: { "age-group": "16-plus" },
			},
			{ path: "totalRate", measure: "claimant-rate" },
		],
	},
});
