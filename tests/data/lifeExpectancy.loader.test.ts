import { describe, expect, it } from "vitest";
import { loadLE } from "@/lib/data/life-expectancy/loader";
import { APRIL_2023_LAD_MERGERS } from "@/lib/data/localAuthority/reorganisations";

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

const rowsFor = (valueColumn: number, valueName: string, offset: number) => {
	const rows = [columnsFor(valueColumn, valueName)];
	for (const [index, code] of ["E06000001", ...PREDECESSORS].entries()) {
		rows.push(
			new Map([
				[0, "2022 to 2024"],
				[2, "Local Areas"],
				[3, code],
				[4, `Authority ${index}`],
				[5, "Male"],
				[7, "<1"],
				[valueColumn, String(offset + index)],
			]),
			new Map([
				[0, "2022 to 2024"],
				[2, "Local Areas"],
				[3, code],
				[4, `Authority ${index}`],
				[5, "Female"],
				[7, "<1"],
				[valueColumn, String(offset + index + 10)],
			]),
		);
	}
	rows.push(
		new Map([
			[0, "2021 to 2023"],
			[2, "Local Areas"],
			[3, "E06000001"],
			[4, "Ignored"],
			[5, "Male"],
			[7, "<1"],
			[valueColumn, "999"],
		]),
	);
	return rows;
};

describe("loadLE", () => {
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

		const datasets = await loadLE(readRows);

		expect(requests).toEqual([
			{
				path: "health/life-expectancy/lifeexpectancylocalareas.xlsx",
				columns: [0, 2, 3, 4, 5, 7, 9],
			},
			{
				path: "health/life-expectancy/healthylifeexpectancyuk.xlsx",
				columns: [0, 2, 3, 4, 5, 7, 9],
			},
		]);
		expect(datasets.le.data.E06000001).toMatchObject({
			maleBirthLE: 70,
			femaleBirthLE: 80,
		});
		expect(datasets.hle?.data.E06000001).toMatchObject({
			maleBirthLE: 60,
			femaleBirthLE: 70,
		});
		expect(datasets.le.data.E06000066).toMatchObject({
			ladName: "Somerset",
			derivedFromPredecessors:
				APRIL_2023_LAD_MERGERS.E06000066.predecessors,
		});
	});
});
