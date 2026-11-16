import { it, expect } from "vitest";
import { sumPlanningRecords } from "@uk-data-atlas/datasets";

it("sums planning counts without treating missing stages as zero", () => {
	const record = {
		code: "E09000001",
		name: "City",
		value: 100,
		metrics: { decided: 80 },
	};
	const total = sumPlanningRecords([record, record]);
	expect(total?.value).toBe(200);
	expect(total?.metrics.decided).toBe(160);
	expect(total?.metrics.withdrawn).toBeUndefined();
	expect(sumPlanningRecords([])).toBeNull();
});
