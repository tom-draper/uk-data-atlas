import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * The two fuels are published separately, as separate accredited official
 * statistics, so each is its own dataset with its own source block. They share
 * a publisher, a licence and a geography.
 */
const SHARED = {
	source: "Department for Energy Security and Net Zero",
	year: "2015-2024",
	licence: "Open Government Licence v3.0",
	licenceUrl:
		"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
} as const;

const description = (fuel: string, extra: string) =>
	`Metered ${fuel} consumption by local authority in Great Britain, 2015 to 2024, split between domestic and non-domestic meters and reported in GWh. ${extra} The series is restated on 2025 local authority codes; earlier published years are on the boundaries in force at the time and are not included.`;

export const ELECTRICITY_CONSUMPTION_SOURCE = {
	...SHARED,
	name: "Subnational electricity consumption",
	sourceUrl:
		"https://www.gov.uk/government/statistics/regional-and-local-authority-electricity-consumption-statistics",
	description: description(
		"electricity",
		"Domestic meters are counted on both standard and Economy 7 tariffs.",
	),
};

export const GAS_CONSUMPTION_SOURCE = {
	...SHARED,
	name: "Subnational gas consumption",
	sourceUrl:
		"https://www.gov.uk/government/statistics/regional-and-local-authority-gas-consumption-statistics",
	description: description(
		"gas",
		"Figures are weather corrected, as the publisher's headline series is, so a cold year is not read as a rise in demand.",
	),
};

/**
 * One part for each year of a fuel's file. An authority with no value is left
 * out rather than read as zero.
 *
 * The three island authorities have no mains gas grid, and the publisher
 * records that as `0` in every year but 2023, where the cells are simply
 * blank. A blank is not a measurement, so the area is absent for that year
 * and the gap is reported rather than filled in with the zero the other years
 * happen to show.
 *
 * DESNZ restates the series on current boundaries, so every year shares the
 * 2025 code vintage. The extract begins at 2015: 2012 to 2014 are on an older
 * local authority vintage and 2005 to 2011 predate GSS codes entirely, so
 * neither resolves against a compiled release and neither is offered.
 */
export async function energyConsumptionStatisticsParts(
	read: (path: string) => Promise<string>,
	fuel: "electricity" | "gas",
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(
			sourceDir("energy-consumption", `${fuel}-lad-2015-2024.csv`),
		),
		{ header: true },
	);
	const byYear = new Map<number, DirectPart["records"]>();
	for (const row of data as Record<string, string>[]) {
		const code = row["ladCode"]?.trim();
		const year = Number(row["year"]);
		if (!code || !Number.isFinite(year)) continue;
		const values = [
			"domesticGwh",
			"nonDomesticGwh",
			"allMetersGwh",
			"metersThousands",
		].map((field) => row[field]?.trim() ?? "");
		if (values.some((value) => value === "")) continue;
		const [domestic, nonDomestic, all, meters] = values.map((value) =>
			parseNum(value),
		);
		const meter = (key: string, value: number | undefined) => ({
			measure: `${fuel}-consumption`,
			members: { "meter-type": key },
			value: value!,
		});
		const records = byYear.get(year) ?? [];
		records.push({
			code,
			name: row["ladName"]?.trim() || "",
			values: [
				meter("allMetersGwh", all),
				meter("domesticGwh", domestic),
				meter("nonDomesticGwh", nonDomestic),
				{ measure: `${fuel}-meters`, value: meters! },
			],
		});
		byYear.set(year, records);
	}
	return [...byYear.entries()]
		.sort(([left], [right]) => left - right)
		.map(([year, records]) => ({ key: String(year), records }));
}
