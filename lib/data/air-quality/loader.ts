import { AirQualityDataset, AirQualityLADData } from "@/lib/types/airQuality";
import { parseCsv, findHeaderLine } from "@/lib/helpers/parseCsv";

const YEAR = 2024;
// The area means are joined to December 2024 authorities and Defra's table is
// on the same April 2023 code set, which every 2024 release shares.
const BOUNDARY_YEAR = 2024;

const number = (value: string | undefined, context: string) => {
	const parsed = Number(value?.trim());
	if (!value?.trim() || !Number.isFinite(parsed))
		throw new Error(`${context} is not a number: ${JSON.stringify(value)}`);
	return parsed;
};

/**
 * Defra's PCM background air pollution for 2024, by local authority.
 *
 * NO2, PM10 and PM2.5 come from the area means compiled from the 1x1 km maps
 * by scripts/compile-air-quality.mts; population-weighted PM2.5 comes from
 * Defra's own local authority table. The two tables must name the same
 * authorities, or the dataset is refused.
 */
export async function loadAirQuality(
	read: (path: string) => Promise<string>,
): Promise<Record<string, AirQualityDataset>> {
	const { data: areaRows } = await parseCsv<Record<string, string>>(
		await read(
			"environment/air-quality/pcm-background-by-local-authority-2024.csv",
		),
		{ header: true },
	);
	const weightedText = await read(
		"environment/air-quality/popwmpm252024byUKlocalauthority.csv",
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

	const records: Record<string, AirQualityLADData> = {};
	for (const row of areaRows as Record<string, string>[]) {
		const ladCode = row.ladCode?.trim();
		if (!ladCode) continue;
		const population = weighted.get(ladCode);
		if (!population)
			throw new Error(`Defra's PM2.5 table has no row for ${ladCode}`);
		records[ladCode] = {
			ladCode,
			ladName: row.ladName?.trim() ?? "",
			no2Mean: number(row.no2Mean, `${ladCode} no2Mean`),
			pm25Mean: row.pm25Mean?.trim()
				? number(row.pm25Mean, `${ladCode} pm25Mean`)
				: null,
			pm10Mean: row.pm10Mean?.trim()
				? number(row.pm10Mean, `${ladCode} pm10Mean`)
				: null,
			gridCells: number(row.gridCells, `${ladCode} gridCells`),
			pm25PopulationWeighted: population.total,
			pm25PopulationWeightedAnthropogenic: population.anthropogenic,
		};
	}
	const unmatched = [...weighted.keys()].filter((code) => !records[code]);
	if (unmatched.length > 0)
		throw new Error(
			`Air quality area means have no row for ${unmatched.join(", ")}`,
		);

	return {
		[YEAR]: {
			id: `airQuality${YEAR}`,
			year: YEAR,
			type: "airQuality",
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		},
	};
}
