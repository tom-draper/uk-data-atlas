import { it, expect } from "vitest";
import { loadGeneralHealth } from "@uk-data-atlas/datasets/data/general-health/loader";
import { sumGeneralHealth } from "@/lib/datasets/generalHealth";
it("loads census counts and recomputes regional percentages", async () => {
	const values = {
		"General health: Very good health": "1",
		"General health: Good health": "2",
		"General health: Fair health": "3",
		"General health: Bad health": "4",
		"General health: Very bad health": "5",
	};
	const result = await loadGeneralHealth(async (_path, _options, visit) => {
		visit({
			...values,
			"geography code": "E01000001",
			geography: "Area",
			"General health: Total: All usual residents": "100",
		});
		visit({
			...values,
			"geography code": "E01000002",
			geography: "Area 2",
			"General health: Total: All usual residents": "0",
		});
	});
	const records = Object.values(result[2021].data);
	expect(records).toHaveLength(1);
	const sum = sumGeneralHealth([
		records[0],
		{ ...records[0], metrics: { ...records[0].metrics, total: 300 } },
	]);
	expect(sum?.metrics.total).toBe(400);
	expect(sum?.value).toBeCloseTo(records[0].value / 2);
	expect(sumGeneralHealth([])).toBeNull();
});
