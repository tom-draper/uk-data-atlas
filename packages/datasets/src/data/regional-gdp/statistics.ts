import { measure } from "../../declaration/measures.ts";
import type { DeclaredStatistics } from "../../declaration/dataset.ts";

export const regionalGdpStatistics: DeclaredStatistics = {
	name: "itlName",
	payload: {
		header: { coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"] },
		code: "itlCode",
	},
	measures: [
		measure(
			"gva",
			"Gross value added",
			"gbp million",
			"amount",
			"sum",
			"Balanced gross value added at current basic prices.",
		),
		measure(
			"gdp",
			"Gross domestic product",
			"gbp million",
			"amount",
			"sum",
			"Gross domestic product at current market prices.",
		),
	],
	fields: [
		{ path: "gvaMillionGbp", measure: "gva" },
		{ path: "gdpMillionGbp", measure: "gdp" },
	],
};
