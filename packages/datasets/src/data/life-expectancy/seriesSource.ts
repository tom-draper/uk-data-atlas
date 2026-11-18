import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import type { DatasetReader } from "../catalog/types.ts";
import { sourceDir } from "../../declaration/sources.ts";

const PERIOD = /^(\d{4}) to (\d{4})$/;
// Unitary authorities, districts, metropolitan and London boroughs, Scottish
// council areas, Welsh principal areas and Northern Irish districts. The
// workbook's "Local Areas" also include English counties (E10), which
// overlap their districts and belong to no single authority release.
const DISTRICT_CODE = /^(E0[6-9]|W06|S12|N09)/;

const SERIES_COLUMNS = [
	[0, "Period"],
	[2, "Area type"],
	[3, "Area code"],
	[4, "Area name"],
	[5, "Sex"],
	[7, "Age group"],
	[9, "Life expectancy"],
	[10, "Lower confidence interval"],
	[11, "Upper confidence interval"],
] as const;

type Estimate = { value: number; lower: number; upper: number };
type Area = { name: string; male?: Estimate; female?: Estimate };

const estimate = (
	row: ReadonlyMap<number, string>,
	context: string,
): Estimate => {
	const text = row.get(9) ?? "";
	const value = Number(text);
	const lower = Number(row.get(10));
	const upper = Number(row.get(11));
	if (![value, lower, upper].every(Number.isFinite) || text.trim() === "")
		throw new Error(
			`Life expectancy series: unreadable estimate for ${context}`,
		);
	return { value, lower, upper };
};

const valueOf = (sex: "male" | "female", found: Estimate) => ({
	measure: "life-expectancy",
	members: { sex },
	...found,
});

/**
 * Every published period of life expectancy at birth for local areas, with its
 * confidence interval, from sheet 1 of the ONS workbook. A part is a period,
 * keyed by its label ("2001-2003").
 *
 * Nothing is derived. ONS restates the whole series on the May 2025 local
 * authority codes, so every period holds the same districts; county rows are
 * set aside, and a period whose areas differ from the others stops the build
 * rather than mixing code vintages.
 */
export async function lifeExpectancySeriesStatisticsParts(
	readRows: DatasetReader["xlsxSheetSelectedRows"],
): Promise<DirectPart[]> {
	const byPeriod = new Map<string, Record<string, Area>>();
	let foundHeaders = false;
	await readRows(
		sourceDir("life-expectancy", "lifeexpectancylocalareas.xlsx"),
		"1",
		SERIES_COLUMNS.map(([column]) => column),
		(row) => {
			if (!foundHeaders) {
				if (row.get(0)?.trim() !== "Period") return;
				const missing = SERIES_COLUMNS.find(
					([column, header]) => row.get(column)?.trim() !== header,
				);
				if (missing)
					throw new Error(
						`Life expectancy series: expected ${missing[1]} in column ${missing[0] + 1}.`,
					);
				foundHeaders = true;
				return;
			}
			if (
				row.get(2)?.trim() !== "Local Areas" ||
				row.get(7)?.trim() !== "<1"
			)
				return;
			const period = row.get(0)?.trim() ?? "";
			const match = PERIOD.exec(period);
			if (!match)
				throw new Error(`Life expectancy series: bad period ${period}`);
			const code = row.get(3)?.trim() ?? "";
			const sex = row.get(5)?.trim();
			if (
				!code ||
				!DISTRICT_CODE.test(code) ||
				(sex !== "Male" && sex !== "Female")
			)
				return;
			const key = `${match[1]}-${match[2]}`;
			const areas = byPeriod.get(key) ?? {};
			const area = (areas[code] ??= { name: row.get(4)?.trim() ?? "" });
			area[sex === "Male" ? "male" : "female"] = estimate(
				row,
				`${code} ${sex} ${period}`,
			);
			byPeriod.set(key, areas);
		},
	);
	if (!foundHeaders)
		throw new Error(
			"Life expectancy series: could not find the header row.",
		);

	const periods = [...byPeriod.keys()].sort();
	if (periods.length === 0)
		throw new Error("Life expectancy series: no local area estimates");
	const codeSet = (period: string) =>
		Object.keys(byPeriod.get(period) ?? {})
			.sort()
			.join(",");
	const expected = codeSet(periods.at(-1) as string);

	return periods.map((period) => {
		if (codeSet(period) !== expected)
			throw new Error(
				`Life expectancy series: ${period} does not cover the same areas as the latest period`,
			);
		const records: DirectRecord[] = Object.entries(
			byPeriod.get(period) ?? {},
		).map(([code, { name, male, female }]) => {
			if (!male || !female)
				throw new Error(
					`Life expectancy series: ${code} lacks a male or female estimate for ${period}`,
				);
			return {
				code,
				name,
				values: [valueOf("male", male), valueOf("female", female)],
			};
		});
		return { key: period, records };
	});
}
