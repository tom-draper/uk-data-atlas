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
	expect(
		censusTableSelector(
			"ts001-lsoa",
			"census-2021-ts001",
			"lsoa",
			2021,
			"2021",
		),
	).toEqual({
		kind: "measure-table",
		id: "ts001-lsoa",
		datasetId: "census-2021-ts001",
		geography: "lsoa",
		boundaryYear: 2021,
		period: "2021",
		measures: [
			"usual-residents-in-households",
			"usual-residents-in-communal-establishments",
			"usual-residents-total",
		],
		columns: [
			{
				measure: "usual-residents",
				dimensions: { "residence-type": "household" },
			},
			{
				measure: "usual-residents",
				dimensions: { "residence-type": "communal-establishment" },
			},
			{
				measure: "usual-residents",
				dimensions: { "residence-type": "total" },
			},
		],
	});
	expect(
		censusTableSelector("other", "income", "localAuthority", 2024, "2024"),
	).toBeUndefined();
});
