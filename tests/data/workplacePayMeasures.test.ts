import { it, expect } from "vitest";
import {
	workplacePay,
	averageWorkplacePay,
} from "@/lib/helpers/workplaceIncomeMeasures";
import type { IncomeLADData } from "@uk-data-atlas/datasets/types/income";
it("keeps resident and workplace measures separate and ignores suppressed estimates", () => {
	const records = [
		{
			annual: { median: 30000, mean: 40000 },
			hourly: { median: 15.25, mean: null },
		},
		{ annual: { median: 50000, mean: null }, hourly: null },
	] as IncomeLADData[];
	const summary = averageWorkplacePay(records);
	expect(workplacePay(summary, "annualMedian")).toBe(40000);
	expect(workplacePay(summary, "annualMean")).toBe(40000);
	expect(workplacePay(summary, "hourlyMedian")).toBe(15.25);
	expect(workplacePay(summary, "hourlyMean")).toBeNull();
	expect(workplacePay(averageWorkplacePay([]), "annualMedian")).toBeNull();
});
