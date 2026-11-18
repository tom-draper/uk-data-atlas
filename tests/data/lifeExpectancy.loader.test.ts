import { describe, expect, it } from "vitest";
import {
	APRIL_2023_LAD_MERGERS,
	lifeExpectancyStatisticsParts,
	sourceDir,
} from "@uk-data-atlas/datasets";

const PREDECESSORS = Object.values(APRIL_2023_LAD_MERGERS).flatMap(
	({ predecessors }) => predecessors as readonly string[],
);

const columnsFor = (valueColumn: number, valueName: string) =>
	new Map([
		[0, "Period"],
		[2, "Area type"],
		[3, "Area code"],
		[4, "Area name"],
		[5, "Sex"],
		[7, "Age group"],
		[valueColumn, valueName],
	]);

const rowFor = (
	valueColumn: number,
	period: string,
	code: string,
	name: string,
	sex: string,
	value: number,
) =>
	new Map([
		[0, period],
		[2, "Local Areas"],
		[3, code],
		[4, name],
		[5, sex],
		[7, "<1"],
		[valueColumn, String(value)],
	]);

const rowsFor = (valueColumn: number, valueName: string, offset: number) => {
	const rows = [columnsFor(valueColumn, valueName)];
	for (const [index, code] of ["E06000001", ...PREDECESSORS].entries()) {
		const name = `Authority ${index}`;
		rows.push(
			rowFor(
				valueColumn,
				"2022 to 2024",
				code,
				name,
				"Male",
				offset + index,
			),
			rowFor(
				valueColumn,
				"2022 to 2024",
				code,
				name,
				"Female",
				offset + index + 10,
			),
		);
	}
	rows.push(
		rowFor(
			valueColumn,
			"2021 to 2023",
			"E06000001",
			"Ignored",
			"Male",
			999,
		),
	);
	return rows;
};

describe("lifeExpectancyStatisticsParts", () => {
	it("reads only the columns needed for the latest local-area estimates", async () => {
		const requests: Array<{ path: string; columns: readonly number[] }> =
			[];
		const readRows = async (
			path: string,
			_sheet: string,
			columns: readonly number[],
			visit: (row: ReadonlyMap<number, string>) => void,
		) => {
			requests.push({ path, columns });
			const healthy = path.includes("healthy");
			for (const row of rowsFor(
				9,
				healthy ? "HLE" : "Life expectancy",
				healthy ? 60 : 70,
			))
				visit(row);
		};

		const parts = await lifeExpectancyStatisticsParts(readRows);

		expect(requests).toEqual([
			{
				path: sourceDir(
					"life-expectancy",
					"lifeexpectancylocalareas.xlsx",
				),
				columns: [0, 2, 3, 4, 5, 7, 9],
			},
			{
				path: sourceDir(
					"life-expectancy",
					"healthylifeexpectancyuk.xlsx",
				),
				columns: [0, 2, 3, 4, 5, 7, 9],
			},
		]);
		expect(parts.map(({ key }) => key)).toEqual(["le", "hle"]);
		const [life, healthy] = parts;
		const valuesOf = (record: {
			values: readonly { value: number | null }[];
		}) => record.values.map(({ value }) => value);
		const first = life.records.find(({ code }) => code === "E06000001")!;
		expect(valuesOf(first)).toEqual([70, 80]);
		expect(first.values.map(({ members }) => members)).toEqual([
			{ sex: "male" },
			{ sex: "female" },
		]);
		expect(
			valuesOf(healthy.records.find(({ code }) => code === "E06000001")!),
		).toEqual([60, 70]);
		const somerset = life.records.find(({ code }) => code === "E06000066")!;
		expect(somerset.name).toBe("Somerset");
		expect(
			Object.values(somerset.parents ?? {}).map((parent) => parent?.code),
		).toEqual(APRIL_2023_LAD_MERGERS.E06000066.predecessors);
	});
});
