import type { CarAvailabilityBreakdown } from "../../types/carAvailability.ts";
import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableInt } from "../../helpers/parseNumber.ts";
import { addMergedCountAuthorities } from "../localAuthority/reorganisations.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * Census category code to the field it contributes to. Code -8, "does not
 * apply", is deliberately absent: it is zero for every authority in this
 * table, and counting it would put non-households in the denominator.
 */
const CATEGORY_MAP: Record<string, keyof CarAvailabilityBreakdown> = {
	"0": "noCar",
	"1": "oneCar",
	"2": "twoCars",
	"3": "threeOrMoreCars",
};

const emptyBreakdown = (): CarAvailabilityBreakdown => ({
	noCar: 0,
	oneCar: 0,
	twoCars: 0,
	threeOrMoreCars: 0,
	total: 0,
});

function pick(row: Record<string, unknown>, ...keys: string[]): string {
	for (const key of keys) {
		const value = row[key];
		if (value !== undefined && value !== null && value !== "")
			return String(value).trim();
	}
	return "";
}

/** Add post-2023 authority records by summing their predecessors. */
export function addMergedCarAvailabilityAuthorities(
	data: Record<string, CarAvailabilityBreakdown>,
): void {
	addMergedCountAuthorities(data, emptyBreakdown, "car availability");
}

/**
 * Census 2021 car or van availability (TS045) by local authority, as the
 * single part `2021`: households with each number of vehicles, and in total.
 * Authorities that merged in 2023 are given the sum of their predecessors, as
 * the table has not been published on the new codes.
 */
export async function carAvailabilityStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(sourceDir("car-availability", "TS045-2021-4.csv")),
		{ header: true },
	);

	const laData: Record<string, CarAvailabilityBreakdown> = {};
	for (const row of data as Record<string, unknown>[]) {
		const ladCode = pick(
			row,
			"Lower tier local authorities Code",
			"Lower Tier Local Authorities Code",
			"geography code",
		);
		if (!ladCode) continue;

		const field =
			CATEGORY_MAP[
				pick(row, "Car or van availability (5 categories) Code")
			];
		if (!field) continue;

		const count = parseNullableInt(pick(row, "Observation", "Count"));
		if (count === null) continue;

		const breakdown = (laData[ladCode] ??= emptyBreakdown());
		breakdown[field] += count;
		breakdown.total += count;
	}
	addMergedCarAvailabilityAuthorities(laData);

	return [
		{
			key: "2021",
			records: Object.entries(laData).map(([code, breakdown]) => ({
				code,
				values: Object.entries(breakdown).map(([key, value]) => ({
					measure: "households",
					members: { "cars-or-vans": key },
					value,
				})),
			})),
		},
	];
}
