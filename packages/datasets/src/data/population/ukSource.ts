import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { readPopulationUkYears } from "./ukLoader.ts";

/**
 * Mid-year population estimates by local authority, sex and single year of
 * age, one part per mid-year. A year no authority has a figure for has no part.
 */
export async function populationUkStatisticsParts(
	readSheet: (path: string, sheet: string) => Promise<string>,
): Promise<DirectPart[]> {
	const parts: DirectPart[] = [];
	for (const [year, authorities] of await readPopulationUkYears(readSheet)) {
		const entries = Object.entries(authorities);
		if (entries.length === 0) continue;
		parts.push({
			key: String(year),
			records: entries.map(([code, authority]) => {
				const values: DirectValue[] = [];
				for (const [sex, counts] of [
					["all", authority.total],
					["male", authority.males],
					["female", authority.females],
				] as const)
					for (const [age, value] of Object.entries(counts))
						values.push({
							measure: "population",
							members: { sex, age },
							value,
						});
				return { code, name: authority.ladName, values };
			}),
		});
	}
	return parts;
}
