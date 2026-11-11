import { it, expect } from "vitest";
import { loadPupilAbsence } from "@uk-data-atlas/datasets";
import { sumMetrics } from "@uk-data-atlas/datasets";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	({ type }) => type === "pupil-absence",
)!;
const absenceRate = (record: unknown, measure: string) =>
	definition.map?.valueFor?.({ data: { A: record } } as never, "A", {
		...DEFAULT_MAP_OPTIONS,
		"pupil-absence": { ...DEFAULT_MAP_OPTIONS["pupil-absence"], measure },
	});
const sumAbsence = (records: Parameters<typeof sumMetrics>[0]) =>
	sumMetrics(records, "overall", "sessions");
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
	const result = await loadPupilAbsence(async (_path, visit, member) => {
		expect(member).toBe("data/1_Absence_3term_nat_reg_la.csv");
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
	expect(absenceRate(sumAbsence(records), "severe")).toBe(2);
	expect(absenceRate(undefined, "overall")).toBeNull();
});
