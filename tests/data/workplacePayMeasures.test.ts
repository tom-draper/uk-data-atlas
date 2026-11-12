import { it, expect } from "vitest";
import { averagePay } from "@uk-data-atlas/datasets";
import type { IncomeLADData } from "@uk-data-atlas/datasets";
it("averages available authority estimates and ignores suppressed ones", () => {
	const records = [
		{
			annual: { median: 30000, mean: 40000 },
			hourly: { median: 15.25, mean: null },
		},
		{ annual: { median: 50000, mean: null }, hourly: null },
	] as IncomeLADData[];
	const summary = averagePay(records);
	expect(summary.annual.median).toBe(40000);
	expect(summary.annual.mean).toBe(40000);
	expect(summary.hourly.median).toBe(15.25);
	expect(summary.hourly.mean).toBeNull();
	expect(averagePay([]).annual.median).toBeNull();
});
