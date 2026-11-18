import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableInt } from "../../helpers/parseNumber.ts";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations.ts";
import { sourceDir } from "../../declaration/sources.ts";

/** Usual residents of an area by ethnic group, keyed by the category's name. */
type EthnicityCounts = Record<string, Record<string, number>>;

/**
 * 2023 unitary-authority mergers whose predecessor districts are the units in
 * the 2021 Census ethnicity release. The ONS documents these exact code
 * changes in its population estimates methods guide:
 * https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/methodologies/populationestimatesforenglandandwalesmid2022methodsguide
 */
export const ETHNICITY_LAD_PREDECESSORS: Record<string, readonly string[]> =
	Object.fromEntries(
		Object.entries(APRIL_2023_LAD_MERGERS).map(
			([target, { predecessors }]) => [target, predecessors],
		),
	);

/** Add derived 2023 authority records by summing every census category. */
export function addMergedEthnicityAuthorities(data: EthnicityCounts): void {
	for (const [target, predecessors] of Object.entries(
		ETHNICITY_LAD_PREDECESSORS,
	)) {
		// Prefer a native record should a future source publish the new code.
		if (data[target]) continue;

		const merged: Record<string, number> = {};
		for (const predecessor of predecessors) {
			const counts = data[predecessor];
			if (!counts) {
				throw new Error(
					`Missing ethnicity predecessor ${predecessor} for ${target}`,
				);
			}
			for (const [category, count] of Object.entries(counts))
				merged[category] = (merged[category] ?? 0) + count;
		}
		data[target] = merged;
	}
}

/** The category's own name, after the "Parent: " the census writes before it. */
function categoryName(fullName: string): string {
	const colonIndex = fullName.indexOf(":");
	return colonIndex === -1
		? fullName.trim()
		: fullName.substring(colonIndex + 1).trim();
}

/**
 * Census 2021 ethnic group (TS021, 19 groups) by local authority, as the
 * single part `2021`. Authorities that merged in 2023 are given the sum of
 * their predecessors, as the table has not been published on the new codes.
 * A group with no count is left out rather than read as none.
 */
export async function ethnicityStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(sourceDir("ethnicity", "TS021-2021-3.csv")),
		{ header: true },
	);

	const counts: EthnicityCounts = {};
	for (const row of data) {
		const code = row["Lower tier local authorities Code"]?.trim();
		const groupCode = row["Ethnic group (20 categories) Code"]?.trim();
		if (!code || !groupCode) continue;
		// The code for the table's total.
		if (groupCode === "-8") continue;

		counts[code] ??= {};
		const observation = parseNullableInt(row["Observation"]);
		if (observation !== null)
			counts[code]![
				categoryName(row["Ethnic group (20 categories)"]?.trim() || "")
			] = observation;
	}

	addMergedEthnicityAuthorities(counts);

	return [
		{
			key: "2021",
			records: Object.entries(counts).map(([code, categories]) => ({
				code,
				values: Object.entries(categories).map(([category, value]) => ({
					measure: "usual-residents",
					members: { "ethnic-group": category },
					value,
				})),
			})),
		},
	];
}
