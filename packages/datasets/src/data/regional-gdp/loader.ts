import type {
	RegionalGdpAreaData,
	RegionalGdpDataset,
} from "../../types/regionalGdp.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * ONS restates the whole 1998 series on current ITL codes with every release,
 * so all twenty-six years share the January 2025 vintage rather than each year
 * carrying the boundaries in force at the time. The 2025 codes renumber much
 * of the 2021 tier, Tees Valley moves from TLC1 to TLC3, so this series does
 * not resolve against the 2021 releases and is deliberately not offered on
 * them.
 */
const BOUNDARY_YEAR = 2025;

type Tier = {
	file: string;
	boundaryType: RegionalGdpDataset["boundaryType"];
};

const TIERS: readonly Tier[] = [
	{ file: "gdp-itl1-1998-2023.csv", boundaryType: "itl1" },
	{ file: "gdp-itl2-1998-2023.csv", boundaryType: "itl2" },
	{ file: "gdp-itl3-1998-2023.csv", boundaryType: "itl3" },
];

/**
 * The key of one tier and year in the compiled payload. The tier the dataset
 * is drawn at keeps the bare year, as the website looks its entries up by
 * year; the other tiers are prefixed with theirs, such as `itl1-2023`.
 */
export const regionalGdpKey = (
	boundaryType: Tier["boundaryType"],
	year: number | string,
) => (boundaryType === "itl3" ? `${year}` : `${boundaryType}-${year}`);

/** The id a tier and year carry in the compiled payload. */
export const regionalGdpId = (
	boundaryType: Tier["boundaryType"],
	year: number | string,
) => `regional-gdp-${boundaryType}${year}`;

const loadTier = async (
	read: (path: string) => Promise<string>,
	{ file, boundaryType }: Tier,
): Promise<Record<string, RegionalGdpDataset>> => {
	const { data } = await parseCsv(
		await read(sourceDir("regional-gdp", `${file}`)),
		{ header: true },
	);

	const byYear = new Map<number, Record<string, RegionalGdpAreaData>>();
	for (const row of data as Record<string, string>[]) {
		const itlCode = row["itlCode"]?.trim();
		const year = Number(row["year"]);
		if (!itlCode || !Number.isFinite(year)) continue;
		const records = byYear.get(year) ?? {};
		records[itlCode] = {
			itlCode,
			itlName: row["itlName"]?.trim() || "",
			gvaMillionGbp: parseNum(row["gvaMillionGbp"]),
			gdpMillionGbp: parseNum(row["gdpMillionGbp"]),
		};
		byYear.set(year, records);
	}

	return Object.fromEntries(
		[...byYear.entries()]
			.sort(([left], [right]) => left - right)
			.map(([year, records]) => [
				regionalGdpKey(boundaryType, year),
				{
					id: regionalGdpId(boundaryType, year),
					type: "regional-gdp" as const,
					year,
					boundaryType,
					boundaryYear: BOUNDARY_YEAR,
					data: records,
				},
			]),
	);
};

/** All three tiers, itl1 first, each year of each tier its own entry. */
export const loadRegionalGdp = async (
	read: (path: string) => Promise<string>,
): Promise<Record<string, RegionalGdpDataset>> => {
	const tiers = await Promise.all(TIERS.map((tier) => loadTier(read, tier)));
	return Object.assign({}, ...tiers);
};
