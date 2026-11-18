import type { DirectPart, DirectValue } from "../../declaration/statistics.ts";
import { parseCsv, findHeaderLine } from "../../helpers/parseCsv.ts";
import { sourceDir } from "../../declaration/sources.ts";

const number = (value: string | undefined, context: string) => {
	const parsed = Number(value?.trim());
	if (!value?.trim() || !Number.isFinite(parsed))
		throw new Error(`${context} is not a number: ${JSON.stringify(value)}`);
	return parsed;
};

/**
 * Defra's PCM background air pollution for 2024, by local authority, as the
 * single part `2024`.
 *
 * NO2, PM10 and PM2.5 come from the area means compiled from the 1x1 km maps
 * by scripts/compile-air-quality.mts, so they and their cell counts are
 * derived. Population-weighted PM2.5 comes from Defra's own local authority
 * table, and is observed. The two tables must name the same authorities, or
 * the dataset is refused.
 */
export async function airQualityStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data: areaRows } = await parseCsv<Record<string, string>>(
		await read(
			sourceDir(
				"air-quality",
				"pcm-background-by-local-authority-2024.csv",
			),
		),
		{ header: true },
	);
	const weightedText = await read(
		sourceDir("air-quality", "popwmpm252024byUKlocalauthority.csv"),
	);
	const { data: weightedRows } = await parseCsv<string[]>(weightedText, {
		header: false,
		skipLines: findHeaderLine(weightedText, "LA code") + 1,
	});
	const weighted = new Map(
		(weightedRows as string[][])
			.filter((row) => /^[ENSW]\d{8}$/.test(row[0]?.trim() ?? ""))
			.map((row) => [
				row[0].trim(),
				{
					total: number(row[1], `${row[0]} PM2.5 total`),
					anthropogenic: number(
						row[3],
						`${row[0]} PM2.5 anthropogenic`,
					),
				},
			]),
	);

	const seen = new Set<string>();
	const records: DirectPart["records"] = [];
	for (const row of areaRows as Record<string, string>[]) {
		const code = row.ladCode?.trim();
		if (!code) continue;
		const population = weighted.get(code);
		if (!population)
			throw new Error(`Defra's PM2.5 table has no row for ${code}`);
		seen.add(code);

		const concentration = (
			pollutant: string,
			cell: string | undefined,
			required: boolean,
		): DirectValue => ({
			measure: "background-concentration",
			members: { pollutant },
			value:
				required || cell?.trim()
					? number(cell, `${code} ${pollutant}Mean`)
					: null,
			status: "derived",
		});
		records.push({
			code,
			name: row.ladName?.trim() ?? "",
			values: [
				concentration("no2", row.no2Mean, true),
				concentration("pm25", row.pm25Mean, false),
				concentration("pm10", row.pm10Mean, false),
				{
					measure: "air-quality-grid-cells",
					value: number(row.gridCells, `${code} gridCells`),
					status: "derived",
				},
				{
					measure: "pm25-population-weighted",
					value: population.total,
				},
				{
					measure: "pm25-population-weighted-anthropogenic",
					value: population.anthropogenic,
				},
			],
		});
	}
	const unmatched = [...weighted.keys()].filter((code) => !seen.has(code));
	if (unmatched.length > 0)
		throw new Error(
			`Air quality area means have no row for ${unmatched.join(", ")}`,
		);

	return [{ key: "2024", records }];
}
