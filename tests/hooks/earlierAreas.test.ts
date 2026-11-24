import { describe, expect, it } from "vitest";
import { earlierAreas, withEarlierPeriods } from "@/lib/measures/earlier";

// Fife was S12000015 until 2018 and Glasgow S12000046 until 2019.
// Buckinghamshire (E06000060) was merged from four districts in 2020, so it
// has no earlier area.
const codes: Record<number, Record<string, string | undefined>> = {
	2020: {
		S12000047: "S12000047",
		S12000049: "S12000049",
		E06000060: undefined,
	},
	2019: {
		S12000047: "S12000047",
		S12000049: "S12000049",
		E06000060: undefined,
	},
	2016: {
		S12000047: "S12000015",
		S12000049: "S12000046",
		E06000060: undefined,
	},
};
const resolver = {
	getCodeForYear: (_type: string, code: string, year: number) =>
		codes[year]?.[code],
};

describe("earlierAreas", () => {
	it("finds the code a recoded authority had on an earlier release", () => {
		expect(
			earlierAreas(
				"S12000047",
				"localAuthority",
				2025,
				[2020, 2019, 2016],
				resolver,
			),
		).toEqual([{ boundaryYear: 2016, area: "S12000015" }]);
	});

	it("reads each earlier code once, from the newest release holding it", () => {
		const twice = {
			getCodeForYear: (_t: string, _c: string, year: number) =>
				year === 2020 ? "E07000242" : "E07000097",
		};
		expect(
			earlierAreas(
				"E07000242",
				"localAuthority",
				2025,
				[2016, 2019, 2020],
				twice,
			),
		).toEqual([{ boundaryYear: 2019, area: "E07000097" }]);
	});

	it("gives nothing for a merged authority or without a resolver", () => {
		expect(
			earlierAreas(
				"E06000060",
				"localAuthority",
				2025,
				[2020, 2016],
				resolver,
			),
		).toEqual([]);
		expect(
			earlierAreas(
				"S12000047",
				"localAuthority",
				2025,
				[2016],
				undefined,
			),
		).toEqual([]);
	});
});

describe("withEarlierPeriods", () => {
	it("fills the periods before the change from the earlier code", () => {
		expect(
			withEarlierPeriods(
				[
					{ period: "2017", value: null },
					{ period: "2018", value: 3 },
					{ period: "2019", value: 4 },
				],
				[
					[
						{ period: "2016", value: 1 },
						{ period: "2017", value: 2 },
						{ period: "2018", value: 99 },
					],
				],
			),
		).toEqual([
			{ period: "2016", value: 1 },
			{ period: "2017", value: 2 },
			{ period: "2018", value: 3 },
			{ period: "2019", value: 4 },
		]);
	});

	it("keeps the line as it is with no earlier values", () => {
		const points = [
			{ period: "2024", value: 1 },
			{ period: "2025", value: null },
		];
		expect(withEarlierPeriods(points, [])).toEqual(points);
	});
});
