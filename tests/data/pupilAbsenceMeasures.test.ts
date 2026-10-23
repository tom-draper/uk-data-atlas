import { it, expect } from "vitest";
import { loadPupilAbsence } from "@uk-data-atlas/datasets/data/pupil-absence/loader";
import { absenceRate, sumAbsence } from "@/lib/datasets/pupilAbsence";
it("filters the full-year total and uses sessions or enrolments as appropriate", async () => {
	const row = {
		time_period: "202425",
		geographic_level: "Local authority",
		education_phase: "Total",
		year_breakdown: "Six half terms",
		new_la_code: "E10000001",
		la_name: "County",
		sess_possible: "1000",
		enrolments: "100",
		sess_overall: "80",
		sess_authorised: "50",
		sess_unauthorised: "30",
		enrolments_pa_10_exact: "20",
		enrolments_pa_50_exact: "2",
	};
	const result = await loadPupilAbsence(async (_path, visit) => {
		visit(row);
		visit({
			...row,
			new_la_code: "E09000001",
			education_phase: "State-funded primary",
		});
	});
	const records = Object.values(result[2025].data);
	expect(records).toHaveLength(1);
	expect(absenceRate(records[0], "overall")).toBe(8);
	expect(absenceRate(records[0], "persistent")).toBe(20);
	expect(absenceRate(sumAbsence(records) ?? undefined, "severe")).toBe(2);
	expect(absenceRate(undefined, "overall")).toBeNull();
});
