import { describe, expect, it } from "vitest";
import {
	lifeExpectancySeriesStatisticsParts,
	sourceDir,
} from "@uk-data-atlas/datasets";

const headers = new Map([
	[0, "Period"],
	[2, "Area type"],
	[3, "Area code"],
	[4, "Area name"],
	[5, "Sex"],
	[7, "Age group"],
	[9, "Life expectancy"],
	[10, "Lower confidence interval"],
	[11, "Upper confidence interval"],
]);

const row = (
	period: string,
	code: string,
	sex: "Male" | "Female",
	[value, lower, upper]: number[],
	ageGroup = "<1",
	areaType = "Local Areas",
) =>
	new Map([
		[0, period],
		[2, areaType],
		[3, code],
		[4, "A place"],
		[5, sex],
		[7, ageGroup],
		[9, String(value)],
		[10, String(lower)],
		[11, String(upper)],
	]);

type Row = ReadonlyMap<number, string>;

/** A reader that streams the given rows after a preamble and the header. */
const readerOf =
	(
		rows: Row[],
		requests: { path: string; columns: readonly number[] }[] = [],
	) =>
	async (
		path: string,
		_sheet: string,
		columns: readonly number[],
		visit: (row: Row) => void,
	) => {
		requests.push({ path, columns });
		visit(new Map([[0, "Contents"]]));
		visit(headers);
		for (const line of rows) visit(line);
	};

const complete = [
	row("2001 to 2003", "E06000001", "Male", [73.42, 72.68, 74.16]),
	row("2001 to 2003", "E06000001", "Female", [79.1, 78.4, 79.8]),
	row("2020 to 2022", "E06000001", "Male", [75.97, 75.21, 76.74]),
	row("2020 to 2022", "E06000001", "Female", [80.08, 79.37, 80.79]),
	// Not life expectancy at birth, and not a local area: both ignored.
	row("2020 to 2022", "E06000001", "Male", [10, 9, 11], "65-69"),
	row("2020 to 2022", "E12000001", "Male", [77, 76, 78], "<1", "Region"),
	// A county is listed among the local areas but overlaps its districts.
	row("2020 to 2022", "E10000003", "Male", [80, 79, 81]),
	row("2020 to 2022", "E10000003", "Female", [84, 83, 85]),
];

describe("lifeExpectancySeriesStatisticsParts", () => {
	it("streams only the columns needed for each estimate", async () => {
		const requests: { path: string; columns: readonly number[] }[] = [];
		await lifeExpectancySeriesStatisticsParts(readerOf(complete, requests));
		expect(requests).toEqual([
			{
				path: sourceDir(
					"life-expectancy",
					"lifeexpectancylocalareas.xlsx",
				),
				columns: [0, 2, 3, 4, 5, 7, 9, 10, 11],
			},
		]);
	});

	it("keeps every period's estimate with its confidence interval", async () => {
		const parts = await lifeExpectancySeriesStatisticsParts(
			readerOf(complete),
		);

		expect(parts.map(({ key }) => key)).toEqual(["2001-2003", "2020-2022"]);
		expect(parts[0].records).toEqual([
			{
				code: "E06000001",
				name: "A place",
				values: [
					{
						measure: "life-expectancy",
						members: { sex: "male" },
						value: 73.42,
						lower: 72.68,
						upper: 74.16,
					},
					{
						measure: "life-expectancy",
						members: { sex: "female" },
						value: 79.1,
						lower: 78.4,
						upper: 79.8,
					},
				],
			},
		]);
		expect(parts[1].records.map(({ code }) => code)).toEqual(["E06000001"]);
	});

	it("refuses a period that covers different areas", async () => {
		const uneven = [
			...complete,
			row("2020 to 2022", "E06000002", "Male", [76, 75, 77]),
			row("2020 to 2022", "E06000002", "Female", [80, 79, 81]),
		];
		await expect(
			lifeExpectancySeriesStatisticsParts(readerOf(uneven)),
		).rejects.toThrow(/2001-2003 does not cover the same areas/);
	});

	it("refuses an area missing one sex", async () => {
		const halfMissing = complete.filter(
			(line) =>
				!(line.get(0) === "2001 to 2003" && line.get(5) === "Female"),
		);
		await expect(
			lifeExpectancySeriesStatisticsParts(readerOf(halfMissing)),
		).rejects.toThrow(
			/E06000001 lacks a male or female estimate for 2001-2003/,
		);
	});
});
