import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

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

/**
 * One part for each year of the published series. The series is restated on
 * current boundaries with every release, so all years share one code vintage.
 *
 * The sector total is summed here, and the total without land use is that
 * total less land use, as the publisher's headline figures are. Per person
 * figures are not stored: they are total emissions over the stored population.
 */
export async function ghgEmissionsStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(sourceDir("ghg-emissions", "ghg-lad-2005-2024.csv")),
		{ header: true },
	);

	const byYear = new Map<number, Map<string, DirectRecord>>();
	for (const row of data as Record<string, string>[]) {
		const code = row["ladCode"]?.trim();
		const year = Number(row["year"]);
		if (!code || !Number.isFinite(year)) continue;

		const sectors = Object.fromEntries(
			SECTORS.map((sector) => [
				sector,
				parseNum(row[SECTOR_COLUMN[sector]]),
			]),
		) as Record<(typeof SECTORS)[number], number>;
		const total = SECTORS.reduce((sum, sector) => sum + sectors[sector], 0);
		const emissions = (key: string, value: number) => ({
			measure: "ghg-emissions",
			members: { "emissions-sector": key },
			value,
		});

		const records = byYear.get(year) ?? new Map<string, DirectRecord>();
		records.set(code, {
			code,
			name: row["ladName"]?.trim() || "",
			values: [
				emissions("totalKtCO2e", total),
				emissions("excludingLandUseKtCO2e", total - sectors.landUse),
				...SECTORS.map((sector) => emissions(sector, sectors[sector])),
				{
					measure: "ghg-population",
					value: parseNum(row["populationThousands"]),
				},
			],
		});
		byYear.set(year, records);
	}

	return [...byYear.entries()]
		.sort(([left], [right]) => left - right)
		.map(([year, records]) => ({
			key: String(year),
			records: [...records.values()],
		}));
}
