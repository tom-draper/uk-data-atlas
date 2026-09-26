import type {
	ElectricityConsumptionDataset,
	EnergyConsumptionLADData,
	GasConsumptionDataset,
} from "@/lib/types/energyConsumption";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum } from "@/lib/helpers/parseNumber";

/**
 * DESNZ restates the series on current boundaries, so every year published
 * here shares the 2025 code vintage. The extract begins at 2015 for that
 * reason: 2012 to 2014 are on an older local authority vintage and 2005 to
 * 2011 predate GSS codes entirely, so neither resolves against a compiled
 * release and neither is offered rather than being silently recoded.
 */
const BOUNDARY_YEAR = 2025;

/**
 * An authority with no value is left out rather than read as zero.
 *
 * The three island authorities have no mains gas grid, and the publisher
 * records that as `0` in every year but 2023, where the cells are simply
 * blank. A blank is not a measurement, so the area is absent for that year
 * and the gap is reported rather than filled in with the zero the other years
 * happen to show.
 */
const load = async (
	read: (path: string) => Promise<string>,
	file: string,
	type: "electricityConsumption" | "gasConsumption",
) => {
	const { data } = await parseCsv(
		await read(`environment/energy-consumption/${file}`),
		{ header: true },
	);

	const byYear = new Map<number, Record<string, EnergyConsumptionLADData>>();
	for (const row of data as Record<string, string>[]) {
		const ladCode = row["ladCode"]?.trim();
		const year = Number(row["year"]);
		if (!ladCode || !Number.isFinite(year)) continue;
		const values = [
			"domesticGwh",
			"nonDomesticGwh",
			"allMetersGwh",
			"metersThousands",
		].map((field) => row[field]?.trim() ?? "");
		if (values.some((value) => value === "")) continue;
		const [domesticGwh, nonDomesticGwh, allMetersGwh, metersThousands] =
			values.map((value) => parseNum(value));
		const records = byYear.get(year) ?? {};
		records[ladCode] = {
			ladCode,
			ladName: row["ladName"]?.trim() || "",
			domesticGwh: domesticGwh!,
			nonDomesticGwh: nonDomesticGwh!,
			allMetersGwh: allMetersGwh!,
			metersThousands: metersThousands!,
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
					boundaryType: "localAuthority" as const,
					boundaryYear: BOUNDARY_YEAR,
					data: records,
				},
			]),
	);
};

export const loadElectricityConsumption = (
	read: (path: string) => Promise<string>,
) =>
	load(
		read,
		"electricity-lad-2015-2024.csv",
		"electricityConsumption",
	) as Promise<Record<string, ElectricityConsumptionDataset>>;

export const loadGasConsumption = (read: (path: string) => Promise<string>) =>
	load(read, "gas-lad-2015-2024.csv", "gasConsumption") as Promise<
		Record<string, GasConsumptionDataset>
	>;
