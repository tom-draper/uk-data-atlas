import type { DeclaredStatistics } from "../../declaration/dataset.ts";
import { regionalGdpId, regionalGdpKey } from "./source.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";

const TIERS = ["itl1", "itl2", "itl3"] as const;

/** Every tier of every year, on the January 2025 codes. */
const regionalGdpParts: NonNullable<DeclaredStatistics["payload"]["parts"]> = (
	labels,
) =>
	TIERS.flatMap((boundaryType) =>
		[
			...new Set(
				// A label is a year; a direct part is asked for by its key.
				labels.flatMap((label) => {
					const year = /^(?:itl\d-)?(\d{4})(?!\d)/.exec(label)?.[1];
					return year ? [year] : [];
				}),
			),
		]
			.sort()
			.map((year) => ({
				key: regionalGdpKey(boundaryType, year),
				header: {
					id: regionalGdpId(boundaryType, year),
					type: "regional-gdp",
					year: Number(year),
					boundaryType,
					boundaryYear: 2025,
					coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
				},
			})),
	);

export const regionalGdpStatistics = (): DeclaredStatistics => ({
	name: "itlName",
	// A key is the year, with the tier before it unless it is ITL3: `2023`, `itl1-2023`.
	period: (key) => periods.year(Number(key.slice(key.lastIndexOf("-") + 1))),
	payload: {
		parts: regionalGdpParts,
		partPerGeography: true,
		code: "itlCode",
	},
	measures: [
		measure(
			"gva",
			"Gross value added",
			"gbp million",
			"total",
			"sum",
			"Balanced gross value added at current basic prices.",
		),
		measure(
			"gdp",
			"Gross domestic product",
			"gbp million",
			"total",
			"sum",
			"Gross domestic product at current market prices.",
		),
	],
	fields: [
		{ path: "gvaMillionGbp", measure: "gva" },
		{ path: "gdpMillionGbp", measure: "gdp" },
	],
});
