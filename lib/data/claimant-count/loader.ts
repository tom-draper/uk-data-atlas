import {
	ClaimantCountDataset,
	ClaimantCountLADData,
} from "@/lib/types/claimantCount";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNumOrZero } from "@/lib/helpers/parseNumber";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";
import { loadPopulationUk } from "../population/ukLoader";

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

/** Add current authority records and calculate their rates from age 16–64 population. */
export function addMergedClaimantAuthorities(
	records: Record<string, ClaimantCountLADData>,
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
		const totalRate = (totalCount / denominator) * 100;

		records[target] = {
			ladCode: target,
			ladName: name,
			totalCount,
			totalRate,
			youthCount,
			youthRate:
				totalCount > 0 ? (youthCount / totalCount) * totalRate : 0,
		};
	}
}

export async function loadClaimantCount(
	read: (path: string) => Promise<string>,
	readPopulation: (path: string, sheet: string) => Promise<string>,
): Promise<Record<string, ClaimantCountDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read("economics/claimant-count/claimant-count-2026.csv"),
		{ header: true },
	);

	const records: Record<string, ClaimantCountLADData> = {};
	let month = "2026";

	for (const row of data as Record<string, string>[]) {
		const code = (row["geography code"] ?? "").trim();
		const name = (row["geography"] ?? "").trim();
		if (!code || !/^[EWSN][0-9]/.test(code)) continue;

		if (!month || month === "2026") month = (row["date"] ?? "2026").trim();

		const totalCount = parseNumOrZero(row[COL_TOTAL_COUNT]);
		const totalRate = parseNumOrZero(row[COL_TOTAL_RATE]);
		const youthCount = parseNumOrZero(row[COL_YOUTH_COUNT]);
		// Youth rate is suppressed in source data — derive from youth/total count ratio
		const youthRate =
			totalCount > 0 ? (youthCount / totalCount) * totalRate : 0;

		records[code] = {
			ladCode: code,
			ladName: name,
			totalCount,
			totalRate,
			youthCount,
			youthRate,
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
	addMergedClaimantAuthorities(records, workingAgePopulation);

	const year = 2026;
	return {
		[year]: {
			id: `claimantCount${year}`,
			type: "claimantCount",
			year,
			month,
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: records,
		},
	};
}
