import { parseCsv } from "@/lib/helpers/parseCsv";
import type {
	LifeExpectancyEstimate,
	LifeExpectancySeriesDataset,
	LifeExpectancySeriesLADData,
} from "@/lib/types/lifeExpectancySeries";

const PERIOD = /^(\d{4}) to (\d{4})$/;

const estimate = (
	row: Record<string, string>,
	context: string,
): LifeExpectancyEstimate => {
	const value = Number(row["Life expectancy (years)"]);
	const lower = Number(row["Lower confidence interval"]);
	const upper = Number(row["Upper confidence interval"]);
	if (
		![value, lower, upper].every(Number.isFinite) ||
		row["Life expectancy (years)"]?.trim() === ""
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
 * Nothing is derived. Authorities the publisher does not report, including the
 * four created in April 2023, are absent, and a period whose areas differ from
 * the others stops the build rather than mixing code vintages.
 */
export async function loadLifeExpectancySeries(
	sheetCsv: string,
): Promise<Record<string, LifeExpectancySeriesDataset>> {
	const { data } = await parseCsv(sheetCsv, { header: true, skipLines: 5 });
	const byPeriod = new Map<
		string,
		Record<string, Partial<LifeExpectancySeriesLADData>>
	>();

	for (const row of data as Record<string, string>[]) {
		if (
			row["Area type"]?.trim() !== "Local Areas" ||
			row["Age group"]?.trim() !== "<1"
		)
			continue;
		const period = row["Period"]?.trim() ?? "";
		const match = PERIOD.exec(period);
		if (!match)
			throw new Error(`Life expectancy series: bad period ${period}`);
		const ladCode = row["Area code"]?.trim();
		const sex = row["Sex"]?.trim();
		if (!ladCode || (sex !== "Male" && sex !== "Female")) continue;

		const key = `${match[1]}-${match[2]}`;
		const records = byPeriod.get(key) ?? {};
		const record = (records[ladCode] ??= {
			ladCode,
			ladName: row["Area name"]?.trim() ?? "",
		});
		record[sex === "Male" ? "male" : "female"] = estimate(
			row,
			`${ladCode} ${sex} ${period}`,
		);
		byPeriod.set(key, records);
	}

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
					boundaryYear: 2021,
					data,
				},
			];
		}),
	);
}
