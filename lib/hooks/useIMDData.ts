// lib/hooks/useIMDData.ts
import { useState, useEffect } from "react";
import { IMDDataset, LSOAIMDRecord } from "@/lib/types/imd";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

const parseFloat_ = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const parsed = parseFloat(val.replace(/,/g, "").trim());
	return isNaN(parsed) ? 0 : parsed;
};

const parseInt_ = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const parsed = parseInt(val.replace(/,/g, "").trim(), 10);
	return isNaN(parsed) ? 0 : parsed;
};

export const useIMDData = () => {
	const [datasets, setDatasets] = useState<Record<string, IMDDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const response = await fetch(
					withCDN("/data/imd/File_7_-_All_IoD2019_Scores__Ranks__Deciles_and_Population_Denominators_3.csv"),
				);
				if (!response.ok)
					throw new Error(`Failed to fetch IMD data: ${response.statusText}`);

				const { data } = await parseCsv(await response.text(), { header: true });

				const records: Record<string, LSOAIMDRecord> = {};
				for (const row of data as any[]) {
					const lsoaCode = row["LSOA code (2011)"]?.trim();
					if (!lsoaCode || !lsoaCode.startsWith("E")) continue;

					records[lsoaCode] = {
						lsoaCode,
						lsoaName: row["LSOA name (2011)"]?.trim() || "",
						ladCode: row["Local Authority District code (2019)"]?.trim() || "",
						ladName: row["Local Authority District name (2019)"]?.trim() || "",
						imdScore: parseFloat_(row["Index of Multiple Deprivation (IMD) Score"]),
						imdRank: parseInt_(row["Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)"]),
						imdDecile: parseInt_(row["Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"]),
						incomeScore: parseFloat_(row["Income Score (rate)"]),
						employmentScore: parseFloat_(row["Employment Score (rate)"]),
						educationScore: parseFloat_(row["Education, Skills and Training Score"]),
						healthScore: parseFloat_(row["Health Deprivation and Disability Score"]),
						crimeScore: parseFloat_(row["Crime Score"]),
						housingScore: parseFloat_(row["Barriers to Housing and Services Score"]),
						livingEnvironmentScore: parseFloat_(row["Living Environment Score"]),
					};
				}

				setDatasets({
					2019: {
						id: "imd2019",
						year: 2019,
						type: "imd",
						boundaryType: "lsoa",
						boundaryYear: 2011,
						data: records,
						metadata: {
							source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019.",
							notes: ["England only. Decile 1 = most deprived 10% of LSOAs."],
						},
					},
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading IMD data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
