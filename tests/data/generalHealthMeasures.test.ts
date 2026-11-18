import { it, expect } from "vitest";
import {
	generalHealthStatisticsParts,
	sumMetrics,
} from "@uk-data-atlas/datasets";

const sumGeneralHealth = (records: Parameters<typeof sumMetrics>[0]) =>
	sumMetrics(records, "goodHealth", "total");
it("reads census counts for each area with residents", async () => {
	const values = {
		"General health: Very good health": "1",
		"General health: Good health": "2",
		"General health: Fair health": "3",
		"General health: Bad health": "4",
		"General health: Very bad health": "5",
	};
	const parts = await generalHealthStatisticsParts(
		async (_path, _options, visit) => {
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
		},
	);
	expect(parts.map((part) => part.key)).toEqual(["2021"]);
	const [record] = parts[0].records;
	expect(parts[0].records).toHaveLength(1);
	expect(record).toMatchObject({ code: "E01000001", name: "Area" });
	expect(
		Object.fromEntries(
			record.values.map((value) => [
				value.members?.["general-health"],
				value.value,
			]),
		),
	).toEqual({
		total: 100,
		veryGood: 1,
		good: 2,
		fair: 3,
		bad: 4,
		veryBad: 5,
	});
});

it("recomputes regional percentages", () => {
	const record = {
		code: "E01000001",
		name: "Area",
		value: 40,
		metrics: { total: 100, goodHealth: 40 },
	};
	const sum = sumGeneralHealth([
		record,
		{ ...record, metrics: { ...record.metrics, total: 300 } },
	]);
	expect(sum?.metrics?.total).toBe(400);
	expect(sum?.value).toBeCloseTo(record.value / 2);
	expect(sumGeneralHealth([])).toBeNull();
});
