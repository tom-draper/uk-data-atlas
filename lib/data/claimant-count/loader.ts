import {
	ClaimantCountDataset,
	ClaimantCountLADData,
} from "@/lib/types/claimantCount";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNumOrZero } from "@/lib/helpers/parseNumber";

const COL_TOTAL_COUNT =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: All categories: Age 16+; measure: Claimant count; measures: Value";
const COL_TOTAL_RATE =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: All categories: Age 16+; measure: Claimants as a proportion of residents aged 16-64; measures: Value";
const COL_YOUTH_COUNT =
	"Benefit: Total (all UC and JSA claimants); Gender: Total; Age: Aged 16-24; measure: Claimant count; measures: Value";

export async function loadClaimantCount(
	read: (path: string) => Promise<string>,
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
