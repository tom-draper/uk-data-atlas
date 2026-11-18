import { describe, expect, it } from "vitest";
import {
	addMergedEthnicityAuthorities,
	ethnicityStatisticsParts,
	ETHNICITY_LAD_PREDECESSORS,
} from "@uk-data-atlas/datasets";

describe("addMergedEthnicityAuthorities", () => {
	const sourceData = () =>
		Object.fromEntries(
			Object.values(ETHNICITY_LAD_PREDECESSORS)
				.flat()
				.map((code, index) => [code, { British: index + 1 }]),
		) as Record<string, Record<string, number>>;

	it("sums each category into every 2023 unitary authority", () => {
		const data = sourceData();

		addMergedEthnicityAuthorities(data);

		for (const [target, predecessors] of Object.entries(
			ETHNICITY_LAD_PREDECESSORS,
		)) {
			const expected = predecessors.reduce(
				(sum, predecessor) => sum + data[predecessor]!.British!,
				0,
			);
			expect(data[target]!.British).toBe(expected);
		}
	});

	it("does not replace a record published under the current authority code", () => {
		const data = sourceData();
		data.E06000063 = { British: 99 };

		addMergedEthnicityAuthorities(data);

		expect(data.E06000063!.British).toBe(99);
	});
});

describe("ethnicityStatisticsParts", () => {
	// The merged authorities need every predecessor, so each has one row.
	const predecessors = Object.values(ETHNICITY_LAD_PREDECESSORS).flat();
	const read = async (rows: string[][]) => {
		const [part] = await ethnicityStatisticsParts(async () =>
			[
				"Lower tier local authorities Code,Ethnic group (20 categories) Code,Ethnic group (20 categories),Observation",
				...[
					...rows,
					...predecessors.map((code) => [
						code,
						"1",
						"Asian: Bangladeshi",
						"10",
					]),
				].map((row) => row.join(",")),
			].join("\n"),
		);
		return part!;
	};

	it("reads each category by its own name, without the table's total", async () => {
		const part = await read([
			["E06000001", "-8", "Does not apply", "5"],
			["E06000001", "1", "Asian: Bangladeshi", "278"],
			["E06000001", "13", "White: Roma", "40"],
			["E06000001", "14", "Irish", ""],
		]);

		expect(part.key).toBe("2021");
		expect(
			part.records.find((record) => record.code === "E06000001")?.values,
		).toEqual([
			{
				measure: "usual-residents",
				members: { "ethnic-group": "Bangladeshi" },
				value: 278,
			},
			{
				measure: "usual-residents",
				members: { "ethnic-group": "Roma" },
				value: 40,
			},
		]);
	});

	it("gives a merged authority the sum of its predecessors", async () => {
		const part = await read([]);
		const [target, members] = Object.entries(
			ETHNICITY_LAD_PREDECESSORS,
		)[0]!;

		expect(
			part.records.find((record) => record.code === target)?.values,
		).toEqual([
			{
				measure: "usual-residents",
				members: { "ethnic-group": "Bangladeshi" },
				value: members.length * 10,
			},
		]);
	});
});
