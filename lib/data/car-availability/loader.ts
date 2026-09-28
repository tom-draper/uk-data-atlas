import type {
	CarAvailabilityBreakdown,
	CarAvailabilityDataset,
} from "@/lib/types/carAvailability";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableInt } from "@/lib/helpers/parseNumber";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

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

/**
 * Add post-2023 authority records by summing their predecessors.
 *
 * The census reports on 2021 boundaries, so the four authorities created in
 * April 2023 have no row of their own and would otherwise be blank on a map
 * drawn with current boundaries.
 */
export function addMergedCarAvailabilityAuthorities(
	data: Record<string, CarAvailabilityBreakdown>,
): void {
	for (const [target, { predecessors }] of Object.entries(
		APRIL_2023_LAD_MERGERS,
	)) {
		if (data[target]) continue;
		const merged = emptyBreakdown();
		for (const predecessor of predecessors) {
			const breakdown = data[predecessor];
			if (!breakdown)
				throw new Error(
					`Missing car availability predecessor ${predecessor} for ${target}`,
				);
			for (const key of Object.keys(merged) as Array<
				keyof CarAvailabilityBreakdown
			>)
				merged[key] += breakdown[key];
		}
		data[target] = merged;
	}
}

export async function loadCarAvailability(
	read: (path: string) => Promise<string>,
): Promise<Record<string, CarAvailabilityDataset>> {
	const { data } = await parseCsv(
		await read("transport/car-availability/TS045-2021-4.csv"),
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

	const records: CarAvailabilityDataset["data"] = {};
	for (const [ladCode, breakdown] of Object.entries(laData))
		records[ladCode] = { ladCode, breakdown };

	return {
		2021: {
			id: "carAvailability2021",
			type: "carAvailability",
			year: 2021,
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: records,
			metadata: {
				source: "Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045.",
				notes: [
					"England and Wales only. Shares are of households, not of people.",
					"The top category is open-ended, so the table gives no vehicle count.",
				],
			},
		},
	};
}
