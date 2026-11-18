import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { endYear } from "../education/ks4.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { schoolYear } from "../school-performance/statistics.ts";

/**
 * Both groups must reach this many pupils before a gap is reported. The
 * release publishes cohorts as small as one pupil, the Isles of Scilly had a
 * single disadvantaged pupil in 2024/25, whose result alone would have shown
 * the district's disadvantaged pupils nineteen points ahead, so a floor is
 * needed to keep the map showing gaps rather than sampling noise.
 */
const MINIMUM_PUPILS = 6;

const DISADVANTAGED = "Disadvantaged";
const NOT_DISADVANTAGED = "Not known to be disadvantaged";

interface Side {
	att8: number | null;
	engmath94: number | null;
	pupils: number | null;
	name: string;
}

const NO_SIDE: Side = { att8: null, engmath94: null, pupils: null, name: "" };

/** The difference, or null when either side is missing or too small to report. */
function difference(
	ahead: number | null,
	behind: number | null,
	aheadPupils: number | null,
	behindPupils: number | null,
): number | null {
	if (ahead === null || behind === null) return null;
	if (aheadPupils === null || behindPupils === null) return null;
	if (aheadPupils < MINIMUM_PUPILS || behindPupils < MINIMUM_PUPILS) {
		return null;
	}
	return Number((ahead - behind).toFixed(1));
}

function readSide(row: Record<string, string>): Side {
	return {
		att8: parseNullableNum(row["attainment8_average"]),
		engmath94: parseNullableNum(row["engmath_94_percent"]),
		pupils: parseNullableNum(row["pupil_count"]),
		name: (row["lad_name"] ?? "").trim(),
	};
}

/**
 * One year's values of a district: Attainment 8 and pupils of each side, and
 * the English and maths gap. The Attainment 8 gap is computed from the two
 * averages, not stored.
 */
function yearValues(
	year: number,
	disadvantaged: Side = NO_SIDE,
	notDisadvantaged: Side = NO_SIDE,
): DirectValue[] {
	const period = schoolYear(String(year));
	const side = (
		measure: string,
		group: string,
		value: number | null,
	): DirectValue => ({
		measure,
		members: { disadvantage: group },
		value,
		period,
	});
	return [
		side("attainment-8", "disadvantaged", disadvantaged.att8),
		side("attainment-8", "not-disadvantaged", notDisadvantaged.att8),
		side("key-stage-4-pupils", "disadvantaged", disadvantaged.pupils),
		side(
			"key-stage-4-pupils",
			"not-disadvantaged",
			notDisadvantaged.pupils,
		),
		{
			measure: "gcse-english-maths-grade-4-gap",
			value: difference(
				notDisadvantaged.engmath94,
				disadvantaged.engmath94,
				notDisadvantaged.pupils,
				disadvantaged.pupils,
			),
			period,
		},
	];
}

/**
 * How far non-disadvantaged pupils are ahead of disadvantaged pupils at key
 * stage 4, by district, as the part of the latest year. Each district carries
 * every year of the release.
 */
export async function schoolPerformanceDisadvantageStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			sourceDir(
				"school-performance",
				"202425_local_authority_district_revised.csv",
			),
		),
		{ header: true },
	);

	// Two rows per district per year, one for each side of the split.
	const sides = new Map<number, Map<string, Record<string, Side>>>();
	for (const row of data as Record<string, string>[]) {
		if (row["geographic_level"] !== "Local authority district") continue;
		if (row["geography_basis"] !== "Pupil residency") continue;
		if (row["breakdown_topic"] !== "Disadvantage status") continue;

		const status = row["disadvantage_status"];
		if (status !== DISADVANTAGED && status !== NOT_DISADVANTAGED) continue;

		const year = endYear((row["time_period"] ?? "").trim());
		if (year === null) continue;
		const code = (row["lad_code"] ?? "").trim();
		// Joint districts ("E07000010 / E07000009") have no boundary.
		if (!/^E\d{8}$/.test(code)) continue;

		const yearSides =
			sides.get(year) ?? new Map<string, Record<string, Side>>();
		const forCode = yearSides.get(code) ?? {};
		forCode[status] = readSide(row);
		yearSides.set(code, forCode);
		sides.set(year, yearSides);
	}

	const years = [...sides.keys()].sort((a, b) => a - b);
	const latest = years[years.length - 1];
	if (latest === undefined)
		throw new Error("KS4 disadvantage data contained no usable rows");

	return [
		{
			key: String(latest),
			records: [...sides.get(latest)!].map(([code, forCode]) => ({
				code,
				name:
					forCode[NOT_DISADVANTAGED]?.name ??
					forCode[DISADVANTAGED]?.name ??
					"",
				values: years.flatMap((year) => {
					const yearForCode = sides.get(year)?.get(code);
					return yearForCode
						? yearValues(
								year,
								yearForCode[DISADVANTAGED],
								yearForCode[NOT_DISADVANTAGED],
							)
						: [];
				}),
			})),
		},
	];
}
