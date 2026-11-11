import { it, expect } from "vitest";
import {
	loadPlanningApplications,
	sumPlanningRecords,
} from "@uk-data-atlas/datasets";
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
	expect(record.metrics?.decided).toBe(80);
	expect(record.metrics?.withdrawn).toBeUndefined();
	const total = sumPlanningRecords([record, record]);
	expect(total?.value).toBe(200);
	expect(total?.metrics.decided).toBe(160);
	// A stage one authority does not report is left out, not summed as zero.
	expect(total?.metrics.withdrawn).toBeUndefined();
	expect(sumPlanningRecords([])).toBeNull();
});
