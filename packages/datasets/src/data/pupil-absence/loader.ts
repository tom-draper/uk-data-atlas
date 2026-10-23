import type { DatasetReader } from "../catalog/types";
import type { IndicatorDataset, IndicatorRecord } from "../../types/indicator";
import { parseNullableNum } from "../../helpers/parseNumber";
export async function loadPupilAbsence(
	read: DatasetReader["zipCsvRows"],
): Promise<Record<string, IndicatorDataset<"pupilAbsence">>> {
	const data: Record<string, IndicatorRecord> = {};
	await read(
		"education/pupil-attendance/2024-25-full-year-absence-data.zip",
		(row) => {
			if (
				row.time_period !== "202425" ||
				row.geographic_level !== "Local authority" ||
				row.education_phase !== "Total" ||
				row.year_breakdown !== "Six half terms"
			)
				return;
			const code = row.new_la_code?.trim();
			if (!code || !/^E(?:0[6789]|10)[0-9]{6}$/.test(code)) return;
			const columns = {
				sessions: "sess_possible",
				enrolments: "enrolments",
				overall: "sess_overall",
				authorised: "sess_authorised",
				unauthorised: "sess_unauthorised",
				persistent: "enrolments_pa_10_exact",
				severe: "enrolments_pa_50_exact",
			};
			const metrics: Record<string, number> = {};
			for (const [key, column] of Object.entries(columns)) {
				const count = parseNullableNum(row[column]);
				if (count == null || count < 0) return;
				metrics[key] = count;
			}
			if (metrics.sessions <= 0 || metrics.enrolments <= 0) return;
			data[code] = {
				code,
				name: row.la_name?.trim() || code,
				value: (metrics.overall / metrics.sessions) * 100,
				metrics,
			};
		},
	);
	return {
		2025: {
			id: "pupilAbsence2025",
			type: "pupilAbsence",
			year: 2025,
			boundaryType: "countyAndUnitaryAuthority",
			boundaryYear: 2025,
			data,
		},
	};
}
