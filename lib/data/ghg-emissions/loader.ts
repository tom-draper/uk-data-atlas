import type {
	GhgEmissionsDataset,
	GhgEmissionsLADData,
} from "@/lib/types/ghgEmissions";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum } from "@/lib/helpers/parseNumber";

/**
 * The published series is restated on current boundaries with every release,
 * so all twenty years share one code vintage rather than each year carrying
 * the boundaries in force at the time.
 */
const BOUNDARY_YEAR = 2025;

const SECTORS = [
	"transport",
	"domestic",
	"industry",
	"commercial",
	"publicSector",
	"agriculture",
	"waste",
	"landUse",
] as const;

/** The extract's column for each sector, where the two names differ. */
const SECTOR_COLUMN: Record<(typeof SECTORS)[number], string> = {
	transport: "transport",
	domestic: "domestic",
	industry: "industry",
	commercial: "commercial",
	publicSector: "publicSector",
	agriculture: "agriculture",
	waste: "waste",
	landUse: "lulucf",
};

export async function loadGhgEmissions(
	read: (path: string) => Promise<string>,
): Promise<Record<string, GhgEmissionsDataset>> {
	const { data } = await parseCsv(
		await read("environment/ghg-emissions/ghg-lad-2005-2024.csv"),
		{ header: true },
	);

	const recordsByYear = new Map<
		number,
		Record<string, GhgEmissionsLADData>
	>();

	for (const row of data as Record<string, string>[]) {
		const ladCode = row["ladCode"]?.trim();
		const year = Number(row["year"]);
		if (!ladCode || !Number.isFinite(year)) continue;

		const sectors = Object.fromEntries(
			SECTORS.map((sector) => [
				sector,
				parseNum(row[SECTOR_COLUMN[sector]]),
			]),
		) as Record<(typeof SECTORS)[number], number>;

		const totalKtCO2e = SECTORS.reduce(
			(total, sector) => total + sectors[sector],
			0,
		);
		const populationThousands = parseNum(row["populationThousands"]);

		const records = recordsByYear.get(year) ?? {};
		records[ladCode] = {
			ladCode,
			ladName: row["ladName"]?.trim() || "",
			totalKtCO2e,
			excludingLandUseKtCO2e: totalKtCO2e - sectors.landUse,
			// kt over thousands of people is already tonnes per person.
			perPersonTCO2e:
				populationThousands > 0 ? totalKtCO2e / populationThousands : 0,
			populationThousands,
			...sectors,
		};
		recordsByYear.set(year, records);
	}

	return Object.fromEntries(
		[...recordsByYear.entries()]
			.sort(([left], [right]) => left - right)
			.map(([year, records]) => [
				year,
				{
					id: `ghgEmissions${year}`,
					type: "ghgEmissions" as const,
					year,
					boundaryType: "localAuthority" as const,
					boundaryYear: BOUNDARY_YEAR,
					data: records,
				},
			]),
	);
}
