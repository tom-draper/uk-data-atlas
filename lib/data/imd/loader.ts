import { IMDDataset, IMDLSOAData } from "@/lib/types/imd";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum, parseNumInt } from "@/lib/helpers/parseNumber";

export async function loadIMD(
	read: (path: string) => Promise<string>,
): Promise<Record<string, IMDDataset>> {
	const text = await read(
		"deprivation/imd/File_7_-_All_IoD2019_Scores__Ranks__Deciles_and_Population_Denominators_3.csv",
	);
	const { data } = await parseCsv(text, { header: true });

	const records: Record<string, IMDLSOAData> = {};
	for (const row of data) {
		const lsoaCode = row["LSOA code (2011)"]?.trim();
		if (!lsoaCode || !lsoaCode.startsWith("E")) continue;

		records[lsoaCode] = {
			lsoaCode,
			lsoaName: row["LSOA name (2011)"]?.trim() || "",
			ladCode: row["Local Authority District code (2019)"]?.trim() || "",
			ladName: row["Local Authority District name (2019)"]?.trim() || "",
			imdScore: parseNum(
				row["Index of Multiple Deprivation (IMD) Score"],
			),
			imdRank: parseNumInt(
				row[
					"Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)"
				],
			),
			imdDecile: parseNumInt(
				row[
					"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"
				],
			),
			incomeScore: parseNum(row["Income Score (rate)"]),
			employmentScore: parseNum(row["Employment Score (rate)"]),
			educationScore: parseNum(
				row["Education, Skills and Training Score"],
			),
			healthScore: parseNum(
				row["Health Deprivation and Disability Score"],
			),
			crimeScore: parseNum(row["Crime Score"]),
			housingScore: parseNum(
				row["Barriers to Housing and Services Score"],
			),
			livingEnvironmentScore: parseNum(row["Living Environment Score"]),
		};
	}

	const ladGroups: Record<string, (typeof records)[string][]> = {};
	for (const r of Object.values(records)) {
		(ladGroups[r.ladCode] ??= []).push(r);
	}
	const ladStats: IMDDataset["ladStats"] = {};
	for (const [lad, lsoas] of Object.entries(ladGroups)) {
		ladStats[lad] = {
			averageIMDScore:
				lsoas.reduce((s, r) => s + r.imdScore, 0) / lsoas.length,
			averageIMDDecile:
				lsoas.reduce((s, r) => s + r.imdDecile, 0) / lsoas.length,
		};
	}

	return {
		2019: {
			id: "imd2019",
			year: 2019,
			type: "imd",
			boundaryType: "lsoa",
			boundaryYear: 2011,
			data: records,
			ladStats,
			metadata: {
				source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019.",
				notes: ["England only. Decile 1 = most deprived 10% of LSOAs."],
			},
		},
	};
}
