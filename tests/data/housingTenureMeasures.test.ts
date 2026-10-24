import { it, expect } from "vitest";
import { loadHousingTenure } from "@uk-data-atlas/datasets/data/housing-tenure/loader";
import { sumHousingTenure } from "@/lib/datasets/housingTenure";
it("loads census counts and recomputes regional percentages", async () => {
	const values = {
		"Tenure of household: Owned": "1",
		"Tenure of household: Owned: Owns outright": "2",
		"Tenure of household: Owned: Owns with a mortgage or loan": "3",
		"Tenure of household: Shared ownership": "4",
		"Tenure of household: Social rented": "5",
		"Tenure of household: Private rented": "6",
		"Tenure of household: Lives rent free": "7",
	};
	const result = await loadHousingTenure(async (_path, _options, visit) => {
		visit({
			...values,
			"geography code": "E01000001",
			geography: "Area",
			"Tenure of household: Total: All households": "100",
		});
		visit({
			...values,
			"geography code": "E01000002",
			geography: "Area 2",
			"Tenure of household: Total: All households": "0",
		});
	});
	const records = Object.values(result[2021].data);
	expect(records).toHaveLength(1);
	const sum = sumHousingTenure([
		records[0],
		{ ...records[0], metrics: { ...records[0].metrics, total: 300 } },
	]);
	expect(sum?.metrics.total).toBe(400);
	expect(sum?.value).toBeCloseTo(records[0].value / 2);
	expect(sumHousingTenure([])).toBeNull();
});
