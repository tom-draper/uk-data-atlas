import { expect, test } from "vitest";
import {
	censusTableSelector,
	partitionByCodeYear,
} from "../src/statistics/selectorPlans.ts";

test("code-year partitions restrict only declared datasets", () => {
	const selector = {
		datasetId: "unemployment",
		measure: "unemployment-rate",
		dimensions: {},
		geography: "localAuthority",
	};
	expect(partitionByCodeYear(selector, "unemployment", ["2019-12"])).toEqual({
		...selector,
		areasIn: ["2019-12"],
	});
	expect(partitionByCodeYear(selector, "income", ["2019-12"])).toEqual(
		selector,
	);
	expect(partitionByCodeYear(selector, "unemployment", [])).toEqual(selector);
	const wardSelector = { ...selector, geography: "ward" };
	expect(
		partitionByCodeYear(wardSelector, "unemployment", ["2019-12"]),
	).toEqual(wardSelector);
});

test("census table selector follows the declared category order", () => {
	const mappings = {
		"usual-residents-in-households": {
			measure: "people",
			dimensions: { residence: "households" },
		},
		"usual-residents-in-communal-establishments": {
			measure: "people",
			dimensions: { residence: "communal" },
		},
		"usual-residents-total": { measure: "people" },
	};
	expect(
		censusTableSelector(
			"ts001-lsoa",
			"census-2021-ts001",
			"lsoa",
			2021,
			"2021",
			mappings,
		),
	).toEqual({
		kind: "measure-table",
		id: "ts001-lsoa",
		datasetId: "census-2021-ts001",
		geography: "lsoa",
		boundaryYear: 2021,
		period: "2021",
		measures: Object.keys(mappings),
		columns: [
			{ measure: "people", dimensions: { residence: "households" } },
			{ measure: "people", dimensions: { residence: "communal" } },
			{ measure: "people", dimensions: {} },
		],
	});
	expect(() =>
		censusTableSelector(
			"ts001-lsoa",
			"census-2021-ts001",
			"lsoa",
			2021,
			"2021",
			{},
		),
	).toThrow(/Missing statistics mapping/);
	expect(
		censusTableSelector(
			"other",
			"income",
			"localAuthority",
			2024,
			"2024",
			{},
		),
	).toBeUndefined();
});
