import { describe, expect, it } from "vitest";
import {
	loadLifeExpectancySeries,
	loadLifeExpectancySeriesRows,
} from "@/lib/data/life-expectancy/seriesLoader";

const HEADER =
	"Period,Country,Area type,Area code,Area name,Sex,Sex code,Age band,Age group,Life expectancy,Lower confidence interval,Upper confidence interval";

const row = (
	period: string,
	code: string,
	sex: "Male" | "Female",
	[value, lower, upper]: number[],
	ageGroup = "<1",
	areaType = "Local Areas",
) =>
	`${period},England,${areaType},${code},A place,${sex},1,1,${ageGroup},${value},${lower},${upper}`;

// Sheet 1 carries five preamble lines before its header.
const sheet = (rows: string[]) =>
	["t", "t", "t", "t", "t", HEADER, ...rows].join("\n");

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

describe("loadLifeExpectancySeries", () => {
	it("streams only the columns needed for each estimate", async () => {
		const requests: Array<{ path: string; columns: readonly number[] }> =
			[];
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
		const streamRows = async (
			path: string,
			_sheet: string,
			columns: readonly number[],
			visit: (row: ReadonlyMap<number, string>) => void,
		) => {
			requests.push({ path, columns });
			visit(headers);
			for (const [period, sex, values] of [
				["2001 to 2003", "Male", [73.42, 72.68, 74.16]],
				["2001 to 2003", "Female", [79.1, 78.4, 79.8]],
				["2020 to 2022", "Male", [75.97, 75.21, 76.74]],
				["2020 to 2022", "Female", [80.08, 79.37, 80.79]],
			] as const)
				visit(
					new Map([
						[0, period],
						[2, "Local Areas"],
						[3, "E06000001"],
						[4, "Hartlepool"],
						[5, sex],
						[7, "<1"],
						[9, String(values[0])],
						[10, String(values[1])],
						[11, String(values[2])],
					]),
				);
		};

		const datasets = await loadLifeExpectancySeriesRows(streamRows);

		expect(requests).toEqual([
			{
				path: "health/life-expectancy/lifeexpectancylocalareas.xlsx",
				columns: [0, 2, 3, 4, 5, 7, 9, 10, 11],
			},
		]);
		expect(datasets[2003].data.E06000001.male).toEqual({
			value: 73.42,
			lower: 72.68,
			upper: 74.16,
		});
	});

	it("keeps every period's estimate with its confidence interval", async () => {
		const datasets = await loadLifeExpectancySeries(sheet(complete));

		expect(Object.keys(datasets)).toEqual(["2003", "2022"]);
		expect(datasets[2022]).toMatchObject({
			type: "lifeExpectancySeries",
			period: "2020-2022",
			boundaryYear: 2025,
		});
		expect(datasets[2003].data.E06000001.male).toEqual({
			value: 73.42,
			lower: 72.68,
			upper: 74.16,
		});
		expect(Object.keys(datasets[2022].data)).toEqual(["E06000001"]);
	});

	it("refuses a period that covers different areas", async () => {
		const uneven = [
			...complete,
			row("2020 to 2022", "E06000002", "Male", [76, 75, 77]),
			row("2020 to 2022", "E06000002", "Female", [80, 79, 81]),
		];
		await expect(loadLifeExpectancySeries(sheet(uneven))).rejects.toThrow(
			/2001-2003 does not cover the same areas/,
		);
	});

	it("refuses an area missing one sex", async () => {
		const halfMissing = complete.filter(
			(line) =>
				!(line.startsWith("2001 to 2003") && line.includes("Female")),
		);
		await expect(
			loadLifeExpectancySeries(sheet(halfMissing)),
		).rejects.toThrow(
			/E06000001 lacks a male or female estimate for 2001-2003/,
		);
	});
});
