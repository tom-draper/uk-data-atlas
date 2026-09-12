import type {
	TravelToWorkBreakdown,
	TravelToWorkDataset,
} from "@/lib/types/travelToWork";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableInt } from "@/lib/helpers/parseNumber";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

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

/**
 * Add post-2023 authority records by summing their predecessors.
 *
 * The census reports on 2021 boundaries, so the four authorities created in
 * April 2023 have no row of their own and would otherwise be blank on a map
 * drawn with current boundaries.
 */
export function addMergedTravelToWorkAuthorities(
	data: Record<string, TravelToWorkBreakdown>,
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
					`Missing travel to work predecessor ${predecessor} for ${target}`,
				);
			for (const key of Object.keys(merged) as Array<
				keyof TravelToWorkBreakdown
			>)
				merged[key] += breakdown[key];
		}
		data[target] = merged;
	}
}

export async function loadTravelToWork(
	read: (path: string) => Promise<string>,
): Promise<Record<string, TravelToWorkDataset>> {
	const { data } = await parseCsv(
		await read("transport/travel-to-work/TS061-2021-6.csv"),
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

	const records: TravelToWorkDataset["data"] = {};
	for (const [ladCode, breakdown] of Object.entries(laData))
		records[ladCode] = { ladCode, breakdown };

	return {
		2021: {
			id: "travelToWork2021",
			type: "travelToWork",
			year: 2021,
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: records,
			metadata: {
				source: "Office for National Statistics. Census 2021: Method used to travel to workplace, England and Wales. TS061.",
				notes: [
					"England and Wales only. Shares are of people in employment, so those not in employment or aged under 16 are excluded.",
					"Working mainly at or from home is counted as a method of travel, as the census reports it.",
				],
			},
		},
	};
}
