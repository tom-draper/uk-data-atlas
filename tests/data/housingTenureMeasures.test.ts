import { it, expect } from "vitest";
import {
	housingTenureStatisticsParts,
	sumMetrics,
} from "@uk-data-atlas/datasets";

const sumHousingTenure = (records: Parameters<typeof sumMetrics>[0]) =>
	sumMetrics(records, "owned", "total");
it("reads census counts for each area with households", async () => {
	const values = {
		"Tenure of household: Owned": "1",
		"Tenure of household: Owned: Owns outright": "2",
		"Tenure of household: Owned: Owns with a mortgage or loan": "3",
		"Tenure of household: Shared ownership": "4",
		"Tenure of household: Social rented": "5",
		"Tenure of household: Private rented": "6",
		"Tenure of household: Lives rent free": "7",
	};
	const parts = await housingTenureStatisticsParts(
		async (_path, _options, visit) => {
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
		},
	);
	expect(parts.map((part) => part.key)).toEqual(["2021"]);
	const [record] = parts[0].records;
	expect(parts[0].records).toHaveLength(1);
	expect(record).toMatchObject({ code: "E01000001", name: "Area" });
	expect(
		Object.fromEntries(
			record.values.map((value) => [value.members?.tenure, value.value]),
		),
	).toEqual({
		total: 100,
		owned: 1,
		outright: 2,
		mortgage: 3,
		shared: 4,
		social: 5,
		private: 6,
		rentFree: 7,
	});
});

it("recomputes regional percentages", () => {
	const record = {
		code: "E01000001",
		name: "Area",
		value: 40,
		metrics: { total: 100, owned: 40 },
	};
	const sum = sumHousingTenure([
		record,
		{ ...record, metrics: { ...record.metrics, total: 300 } },
	]);
	expect(sum?.metrics?.total).toBe(400);
	expect(sum?.value).toBeCloseTo(record.value / 2);
	expect(sumHousingTenure([])).toBeNull();
});
