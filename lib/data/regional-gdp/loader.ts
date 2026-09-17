import type {
	RegionalGdpAreaData,
	RegionalGdpItl1Dataset,
	RegionalGdpItl2Dataset,
	RegionalGdpItl3Dataset,
} from "@/lib/types/regionalGdp";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum } from "@/lib/helpers/parseNumber";

/**
 * ONS restates the whole 1998 series on current ITL codes with every release,
 * so all twenty-six years share the January 2025 vintage rather than each year
 * carrying the boundaries in force at the time. The 2025 codes renumber much
 * of the 2021 tier — Tees Valley moves from TLC1 to TLC3 — so this series does
 * not resolve against the 2021 releases and is deliberately not offered on
 * them.
 */
const BOUNDARY_YEAR = 2025;

type Tier = {
	file: string;
	type: "regionalGdpItl1" | "regionalGdpItl2" | "regionalGdpItl3";
	boundaryType: "itl1" | "itl2" | "itl3";
};

const load = async (
	read: (path: string) => Promise<string>,
	{ file, type, boundaryType }: Tier,
) => {
	const { data } = await parseCsv(
		await read(`economics/regional-gdp/${file}`),
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
				year,
				{
					id: `${type}${year}`,
					type,
					year,
					boundaryType,
					boundaryYear: BOUNDARY_YEAR,
					data: records,
				},
			]),
	);
};

export const loadRegionalGdpItl1 = (read: (path: string) => Promise<string>) =>
	load(read, {
		file: "gdp-itl1-1998-2023.csv",
		type: "regionalGdpItl1",
		boundaryType: "itl1",
	}) as Promise<Record<string, RegionalGdpItl1Dataset>>;

export const loadRegionalGdpItl2 = (read: (path: string) => Promise<string>) =>
	load(read, {
		file: "gdp-itl2-1998-2023.csv",
		type: "regionalGdpItl2",
		boundaryType: "itl2",
	}) as Promise<Record<string, RegionalGdpItl2Dataset>>;

export const loadRegionalGdpItl3 = (read: (path: string) => Promise<string>) =>
	load(read, {
		file: "gdp-itl3-1998-2023.csv",
		type: "regionalGdpItl3",
		boundaryType: "itl3",
	}) as Promise<Record<string, RegionalGdpItl3Dataset>>;
