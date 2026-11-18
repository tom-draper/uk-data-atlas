import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

/** The session counts, then the enrolment counts, by the file's column. */
const SESSION_COLUMNS = {
	sessions: "sess_possible",
	overall: "sess_overall",
	authorised: "sess_authorised",
	unauthorised: "sess_unauthorised",
} as const;
const ENROLMENT_COLUMNS = {
	enrolments: "enrolments",
	persistent: "enrolments_pa_10_exact",
	severe: "enrolments_pa_50_exact",
} as const;

/**
 * Full-year 2024/25 absence of each county and unitary authority in England,
 * as the one part `2025`. An authority with a missing or negative count, or
 * with no possible sessions or enrolments, is left out, because its rates
 * could not be read from the counts.
 */
export async function pupilAbsenceStatisticsParts(
	read: DatasetReader["zipCsvRows"],
): Promise<DirectPart[]> {
	const records = new Map<string, DirectRecord>();
	await read(
		sourceDir("pupil-absence", "2024-25-full-year-absence-data.zip"),
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
			const counts: Record<string, number> = {};
			for (const column of [
				...Object.entries(SESSION_COLUMNS),
				...Object.entries(ENROLMENT_COLUMNS),
			]) {
				const count = parseNullableNum(row[column[1]]);
				if (count == null || count < 0) return;
				counts[column[0]] = count;
			}
			if (counts.sessions <= 0 || counts.enrolments <= 0) return;
			records.set(code, {
				code,
				name: row.la_name?.trim() || code,
				values: [
					...Object.keys(SESSION_COLUMNS).map((key) => ({
						measure: "school-sessions",
						members: { "session-type": key },
						value: counts[key],
					})),
					...Object.keys(ENROLMENT_COLUMNS).map((key) => ({
						measure: "pupil-enrolments",
						members: { "absence-level": key },
						value: counts[key],
					})),
				],
			});
		},
		"data/1_Absence_3term_nat_reg_la.csv",
	);
	return [{ key: "2025", records: [...records.values()] }];
}
