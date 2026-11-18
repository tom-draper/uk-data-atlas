import type { TravelToWorkBreakdown } from "../../types/travelToWork.ts";
import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableInt } from "../../helpers/parseNumber.ts";
import { addMergedCountAuthorities } from "../localAuthority/reorganisations.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * Census category code to the field it contributes to. Several codes fold into
 * one mode: the census separates driving from being a passenger, and counts
 * three kinds of public transport apart.
 *
 * Code 12, "not in employment or aged 15 years and under", is deliberately
 * absent. Leaving it out makes the denominator people in employment, which is
 * what a mode share means.
 */
const CATEGORY_MAP: Record<string, keyof TravelToWorkBreakdown> = {
	"1": "workFromHome",
	"2": "publicTransport",
	"3": "publicTransport",
	"4": "publicTransport",
	"5": "taxi",
	"6": "motorcycle",
	"7": "car",
	"8": "car",
	"9": "bicycle",
	"10": "onFoot",
	"11": "other",
};

const emptyBreakdown = (): TravelToWorkBreakdown => ({
	workFromHome: 0,
	publicTransport: 0,
	car: 0,
	taxi: 0,
	motorcycle: 0,
	bicycle: 0,
	onFoot: 0,
	other: 0,
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
export function addMergedTravelToWorkAuthorities(
	data: Record<string, TravelToWorkBreakdown>,
): void {
	addMergedCountAuthorities(data, emptyBreakdown, "travel to work");
}

/**
 * Census 2021 method of travel to work (TS061) by local authority, as the
 * single part `2021`: people in employment by travel mode, and in total.
 * Authorities that merged in 2023 are given the sum of their predecessors, as
 * the table has not been published on the new codes.
 */
export async function travelToWorkStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(sourceDir("travel-to-work", "TS061-2021-6.csv")),
		{ header: true },
	);

	const laData: Record<string, TravelToWorkBreakdown> = {};
	for (const row of data as Record<string, unknown>[]) {
		const ladCode = pick(
			row,
			"Lower tier local authorities Code",
			"Lower Tier Local Authorities Code",
			"geography code",
		);
		if (!ladCode) continue;

		const categoryCode = pick(
			row,
			"Method used to travel to workplace (12 categories) Code",
			"Method of travel to workplace (12 categories) Code",
		);
		const field = CATEGORY_MAP[categoryCode];
		if (!field) continue;

		const count = parseNullableInt(pick(row, "Observation", "Count"));
		if (count === null) continue;

		const breakdown = (laData[ladCode] ??= emptyBreakdown());
		breakdown[field] += count;
		breakdown.total += count;
	}
	addMergedTravelToWorkAuthorities(laData);

	return [
		{
			key: "2021",
			records: Object.entries(laData).map(([code, breakdown]) => ({
				code,
				values: Object.entries(breakdown).map(([key, value]) => ({
					measure: "people-in-employment",
					members: { "travel-method": key },
					value,
				})),
			})),
		},
	];
}
