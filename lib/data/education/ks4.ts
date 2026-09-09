/**
 * Shared reading of the DfE KS4 performance release, which the atlas compiles
 * three times over — by local authority district, by parliamentary
 * constituency, and by disadvantage gap. The columns are identical in each;
 * only the geographic level and the filtering differ.
 */
import type { SchoolPerformanceMeasures } from "@/lib/types/schoolPerformance";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

/**
 * "202425" is the 2024/25 academic year. The atlas keys these by the year the
 * academic year ends in, so 202425 becomes 2025.
 */
export function endYear(timePeriod: string): number | null {
	const start = Number(timePeriod.slice(0, 4));
	return Number.isFinite(start) && start > 1900 ? start + 1 : null;
}

export function readMeasures(
	row: Record<string, string>,
): SchoolPerformanceMeasures {
	return {
		ptL2basics94: parseNullableNum(row["engmath_94_percent"]),
		ptL2basics95: parseNullableNum(row["engmath_95_percent"]),
		avgAtt8: parseNullableNum(row["attainment8_average"]),
		avgP8score: parseNullableNum(row["progress8_average"]),
		pupils: parseNullableNum(row["pupil_count"]),
	};
}
