import { parseCsv } from "@/lib/helpers/parseCsv";
import type {
	LifeExpectancyEstimate,
	LifeExpectancySeriesDataset,
	LifeExpectancySeriesLADData,
} from "@/lib/types/lifeExpectancySeries";
import type { DatasetReader } from "../catalog/types";

const PERIOD = /^(\d{4}) to (\d{4})$/;
// Unitary authorities, districts, metropolitan and London boroughs, Scottish
// council areas, Welsh principal areas and Northern Irish districts. The
// workbook's "Local Areas" also include English counties (E10), which
// overlap their districts and belong to no single authority release.
const DISTRICT_CODE = /^(E0[6-9]|W06|S12|N09)/;

type LifeExpectancySeriesRow = {
	period: string;
	areaType: string;
	areaCode: string;
	areaName: string;
	sex: string;
	ageGroup: string;
	value: string;
	lower: string;
	upper: string;
};

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

const estimate = (
	row: LifeExpectancySeriesRow,
	context: string,
): LifeExpectancyEstimate => {
	const value = Number(row.value);
	const lower = Number(row.lower);
	const upper = Number(row.upper);
	if (
		![value, lower, upper].every(Number.isFinite) ||
		row.value.trim() === ""
	)
		throw new Error(
			`Life expectancy series: unreadable estimate for ${context}`,
		);
	return { value, lower, upper };
};

/**
 * Every published period of life expectancy at birth for local areas, with its
 * confidence interval, from sheet 1 of the ONS workbook.
 *
 * Nothing is derived. ONS restates the whole series on the May 2025 local
 * authority codes, so every period holds the same districts; county rows are
 * set aside, and a period whose areas differ from the others stops the build
 * rather than mixing code vintages.
 */
const loadSeriesRows = async (
	read: (visit: (row: LifeExpectancySeriesRow) => void) => Promise<void>,
): Promise<Record<string, LifeExpectancySeriesDataset>> => {
	const byPeriod = new Map<
		string,
		Record<string, Partial<LifeExpectancySeriesLADData>>
	>();

	await read((row) => {
		if (
			row.areaType.trim() !== "Local Areas" ||
			row.ageGroup.trim() !== "<1"
		)
			return;
		const period = row.period.trim();
		const match = PERIOD.exec(period);
		if (!match)
			throw new Error(`Life expectancy series: bad period ${period}`);
		const ladCode = row.areaCode.trim();
		const sex = row.sex.trim();
		if (
			!ladCode ||
			!DISTRICT_CODE.test(ladCode) ||
			(sex !== "Male" && sex !== "Female")
		)
			return;

		const key = `${match[1]}-${match[2]}`;
		const records = byPeriod.get(key) ?? {};
		const record = (records[ladCode] ??= {
			ladCode,
			ladName: row.areaName.trim(),
		});
		record[sex === "Male" ? "male" : "female"] = estimate(
			row,
			`${ladCode} ${sex} ${period}`,
		);
		byPeriod.set(key, records);
	});

	const periods = [...byPeriod.keys()].sort();
	if (periods.length === 0)
		throw new Error("Life expectancy series: no local area estimates");
	const codeSet = (period: string) =>
		Object.keys(byPeriod.get(period) ?? {})
			.sort()
			.join(",");
	const expected = codeSet(periods.at(-1) as string);

	return Object.fromEntries(
		periods.map((period) => {
			if (codeSet(period) !== expected)
				throw new Error(
					`Life expectancy series: ${period} does not cover the same areas as the latest period`,
				);
			const data: Record<string, LifeExpectancySeriesLADData> = {};
			for (const [code, record] of Object.entries(
				byPeriod.get(period) ?? {},
			)) {
				if (!record.male || !record.female)
					throw new Error(
						`Life expectancy series: ${code} lacks a male or female estimate for ${period}`,
					);
				data[code] = record as LifeExpectancySeriesLADData;
			}
			const year = Number(period.slice(-4));
			return [
				String(year),
				{
					id: `lifeExpectancySeries${year}`,
					type: "lifeExpectancySeries" as const,
					year,
					period,
					boundaryType: "localAuthority" as const,
					boundaryYear: 2025,
					data,
				},
			];
		}),
	);
};

export async function loadLifeExpectancySeries(
	sheetCsv: string,
): Promise<Record<string, LifeExpectancySeriesDataset>> {
	const { data } = await parseCsv(sheetCsv, { header: true, skipLines: 5 });
	return loadSeriesRows(async (visit) => {
		for (const row of data as Record<string, string>[])
			visit({
				period: row["Period"] ?? "",
				areaType: row["Area type"] ?? "",
				areaCode: row["Area code"] ?? "",
				areaName: row["Area name"] ?? "",
				sex: row["Sex"] ?? "",
				ageGroup: row["Age group"] ?? "",
				value: row["Life expectancy"] ?? "",
				lower: row["Lower confidence interval"] ?? "",
				upper: row["Upper confidence interval"] ?? "",
			});
	});
}

export async function loadLifeExpectancySeriesRows(
	readRows: DatasetReader["xlsxSheetSelectedRows"],
): Promise<Record<string, LifeExpectancySeriesDataset>> {
	let foundHeaders = false;
	return loadSeriesRows(async (visit) => {
		await readRows(
			"health/life-expectancy/lifeexpectancylocalareas.xlsx",
			"1",
			SERIES_COLUMNS.map(([column]) => column),
			(row) => {
				if (!foundHeaders) {
					if (row.get(0)?.trim() !== "Period") return;
					const missing = SERIES_COLUMNS.find(
						([column, header]) =>
							row.get(column)?.trim() !== header,
					);
					if (missing)
						throw new Error(
							`Life expectancy series: expected ${missing[1]} in column ${missing[0] + 1}.`,
						);
					foundHeaders = true;
					return;
				}
				visit({
					period: row.get(0) ?? "",
					areaType: row.get(2) ?? "",
					areaCode: row.get(3) ?? "",
					areaName: row.get(4) ?? "",
					sex: row.get(5) ?? "",
					ageGroup: row.get(7) ?? "",
					value: row.get(9) ?? "",
					lower: row.get(10) ?? "",
					upper: row.get(11) ?? "",
				});
			},
		);
		if (!foundHeaders)
			throw new Error(
				"Life expectancy series: could not find the header row.",
			);
	});
}
