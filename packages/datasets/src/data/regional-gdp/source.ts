import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * One ONS workbook covers all three ITL tiers, and the dataset carries all three
 * as separate partitions rather than mixing them in one total.
 */
export const REGIONAL_GDP_SOURCE = {
	source: "Office for National Statistics",
	sourceUrl:
		"https://www.ons.gov.uk/economy/grossdomesticproductgdp/datasets/regionalgrossdomesticproductallnutslevelregions",
	year: "1998-2023",
	licence: "Open Government Licence v3.0",
	licenceUrl:
		"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
} as const;

export const regionalGdpDescription = (tier: string) =>
	`Balanced gross value added at current basic prices and gross domestic product at current market prices, in £ million, for ${tier}, 1998 to 2023. Extracted from tables 1 and 5 of the published workbook, which restates the whole series on January 2025 ITL codes.`;

type Tier = { file: string; boundaryType: "itl1" | "itl2" | "itl3" };

const TIERS: readonly Tier[] = [
	{ file: "gdp-itl1-1998-2023.csv", boundaryType: "itl1" },
	{ file: "gdp-itl2-1998-2023.csv", boundaryType: "itl2" },
	{ file: "gdp-itl3-1998-2023.csv", boundaryType: "itl3" },
];

/**
 * The key of one tier and year. The tier the dataset is drawn at keeps the bare
 * year, as the website looks its entries up by year; the other tiers are
 * prefixed with theirs, such as `itl1-2023`.
 */
export const regionalGdpKey = (
	boundaryType: Tier["boundaryType"],
	year: number | string,
) => (boundaryType === "itl3" ? `${year}` : `${boundaryType}-${year}`);

/** The id a tier and year carry in the payload. */
export const regionalGdpId = (
	boundaryType: Tier["boundaryType"],
	year: number | string,
) => `regional-gdp-${boundaryType}${year}`;

/**
 * All three tiers, itl1 first, one part per tier and year. ONS restates the
 * whole 1998 series on January 2025 ITL codes with every release.
 */
export const regionalGdpStatisticsParts = async (
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> => {
	const parts: DirectPart[] = [];
	for (const { file, boundaryType } of TIERS) {
		const { data } = await parseCsv<Record<string, string>>(
			await read(sourceDir("regional-gdp", file)),
			{ header: true },
		);
		const byYear = new Map<number, Map<string, DirectRecord>>();
		for (const row of data) {
			const code = row["itlCode"]?.trim();
			const year = Number(row["year"]);
			if (!code || !Number.isFinite(year)) continue;
			const values: DirectRecord["values"] = [
				{ measure: "gva", value: parseNum(row["gvaMillionGbp"]!) },
				{ measure: "gdp", value: parseNum(row["gdpMillionGbp"]!) },
			];
			const records = byYear.get(year) ?? new Map<string, DirectRecord>();
			records.set(code, {
				code,
				name: row["itlName"]?.trim() || "",
				values,
			});
			byYear.set(year, records);
		}
		for (const [year, records] of [...byYear].sort(([a], [b]) => a - b))
			parts.push({
				key: regionalGdpKey(boundaryType, year),
				records: [...records.values()],
			});
	}
	return parts;
};
