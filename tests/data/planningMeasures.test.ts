import { it, expect } from "vitest";
import { loadPlanningApplications } from "@uk-data-atlas/datasets/data/new-datasets/loader";
import {
	planningValue,
	sumPlanningRecords,
} from "@/lib/helpers/planningApplicationsMeasures";
it("collects planning counts and preserves suppressed values", async () => {
	const result = await loadPlanningApplications(
		async (_path, _options, visit) => {
			visit({
				LPACD: "E09000001",
				LPANM: "City",
				Quarter: "2026 Q1",
				"Applications received": "100",
				"Applications decided": "80",
				"Applications withdrawn": "..",
				"Applications at end of the quarter": "140",
			});
		},
	);
	const record = result[2026].data.E09000001;
	expect(planningValue(record, "decided")).toBe(80);
	expect(planningValue(record, "withdrawn")).toBeNull();
	expect(
		planningValue(
			sumPlanningRecords([record, record]) ?? undefined,
			"outstanding",
		),
	).toBe(280);
	expect(sumPlanningRecords([])).toBeNull();
});
