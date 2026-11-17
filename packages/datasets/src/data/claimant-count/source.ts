import type {
	DirectPart,
	DirectRecord,
} from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNumOrZero } from "../../helpers/parseNumber.ts";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations.ts";
import { loadPopulationUk } from "../population/ukLoader.ts";

const COL_TOTAL_COUNT =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: All categories: Age 16+; measure: Claimant count; measures: Value";
const COL_TOTAL_RATE =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: All categories: Age 16+; measure: Claimants as a proportion of residents aged 16-64; measures: Value";
const COL_YOUTH_COUNT =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: Aged 16-24; measure: Claimant count; measures: Value";

/**
 * The 2026 Nomis extract still reports the pre-April-2023 districts. The
 * replacements are current local authorities in the boundary release used by
 * this chart.
 */
export const CLAIMANT_COUNT_LAD_PREDECESSORS = APRIL_2023_LAD_MERGERS;

/** One authority's claimants: all aged 16 and over, those aged 16 to 24, and the rate. */
export type ClaimantFigures = {
	name: string;
	totalCount: number;
	totalRate: number;
	youthCount: number;
};

/** Add current authority records and calculate their rates from age 16–64 population. */
export function addMergedClaimantAuthorities(
	records: Record<string, ClaimantFigures>,
	workingAgePopulation: Record<string, number>,
): void {
	for (const [target, { name, predecessors }] of Object.entries(
		CLAIMANT_COUNT_LAD_PREDECESSORS,
	)) {
		if (records[target]) continue;

		const source = predecessors.map((code) => {
			const record = records[code];
			if (!record)
				throw new Error(
					`Missing claimant count predecessor ${code} for ${target}`,
				);
			return record;
		});
		const totalCount = source.reduce(
			(sum, record) => sum + record.totalCount,
			0,
		);
		const youthCount = source.reduce(
			(sum, record) => sum + record.youthCount,
			0,
		);
		const denominator = workingAgePopulation[target];
		if (!denominator)
			throw new Error(
				`Missing working-age population for merged authority ${target}`,
			);

		records[target] = {
			name,
			totalCount,
			totalRate: (totalCount / denominator) * 100,
			youthCount,
		};
	}
}

/**
 * The April 2026 claimant count of each local authority, with the authorities
 * created in April 2023 added from the districts they replaced. The youth rate
 * is suppressed in the source, so it is derived from the rows, not stored.
 */
export async function claimantCountStatisticsPart(
	read: (path: string) => Promise<string>,
	readPopulation: (path: string, sheet: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(sourceDir("claimant-count", "claimant-count-2026.csv")),
		{ header: true },
	);

	const figures: Record<string, ClaimantFigures> = {};
	for (const row of data) {
		const code = (row["geography code"] ?? "").trim();
		if (!code || !/^[EWSN][0-9]/.test(code)) continue;
		figures[code] = {
			name: (row["geography"] ?? "").trim(),
			totalCount: parseNumOrZero(row[COL_TOTAL_COUNT]),
			totalRate: parseNumOrZero(row[COL_TOTAL_RATE]),
			youthCount: parseNumOrZero(row[COL_YOUTH_COUNT]),
		};
	}

	const population = await loadPopulationUk(readPopulation);
	const workingAgePopulation = Object.fromEntries(
		Object.entries(population[2024]?.data ?? {}).map(([code, record]) => [
			code,
			Object.entries(record.total)
				.filter(([age]) => Number(age) >= 16 && Number(age) <= 64)
				.reduce((sum, [, count]) => sum + count, 0),
		]),
	);
	addMergedClaimantAuthorities(figures, workingAgePopulation);

	const records: DirectRecord[] = Object.entries(figures).map(
		([code, figure]) => ({
			code,
			name: figure.name,
			values: [
				{
					measure: "claimants",
					members: { "age-group": "totalCount" },
					value: figure.totalCount,
				},
				{
					measure: "claimants",
					members: { "age-group": "youthCount" },
					value: figure.youthCount,
				},
				{ measure: "claimant-rate", value: figure.totalRate },
			],
		}),
	);
	return [{ key: "2026", records }];
}
