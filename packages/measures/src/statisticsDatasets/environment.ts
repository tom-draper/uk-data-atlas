import { type DeclaredDataset, periods } from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import { PREMISES, measure, per100k } from "./measures.ts";

/** Energy, emissions, air, land, waste and connectivity. */

export const WASTE: DeclaredDataset = {
	type: "waste",
	module: "environment",
	payload: {
		parts: yearParts(
			"waste",
			"localAuthority",
			2025,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "code",
	},
	name: "name",
	period: () => periods.financialYear(2024),
	measures: [
		measure(
			"collected-waste",
			"Local authority collected waste",
			"tonnes",
			"amount",
			"sum",
			"Waste collected by the local authority, collection authorities only.",
		),
		measure(
			"household-waste-recycled",
			"Household waste sent for recycling",
			"tonnes",
			"amount",
			"sum",
			"Household waste sent for reuse, recycling or composting.",
		),
	],
	fields: [
		{ path: "value", measure: "collected-waste" },
		{ path: "metrics.recycledTonnes", measure: "household-waste-recycled" },
	],
	...per100k((record) => record.value, 2024),
};
