// lib/hooks/useBrexitData.ts
import { useState, useEffect } from "react";
import { BrexitDataset, BrexitAreaData } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

const parseNumberStrict = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const cleaned = val.replace(/,/g, "").trim();
	const parsed = Number(cleaned);
	return isNaN(parsed) ? 0 : parsed;
};

export const useBrexitData = () => {
	const [datasets, setDatasets] = useState<Record<string, BrexitDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const response = await fetch(
					withCDN("/data/referendum/EU-referendum-result-data.csv"),
				);
				if (!response.ok)
					throw new Error(`Failed to fetch Brexit data: ${response.statusText}`);

				const { data } = await parseCsv(await response.text(), { header: true });
				const rows = data as Record<string, string>[];

				const records: Record<string, BrexitAreaData> = {};
				const resultMap: Record<string, "remain" | "leave"> = {};

				for (const row of rows) {
					const areaCode = row["Area_Code"]?.trim() || "";
					if (!areaCode) continue;

					const pctLeave = parseNumberStrict(row["Pct_Leave"]);
					const pctRemain = parseNumberStrict(row["Pct_Remain"]);

					records[areaCode] = {
						areaCode,
						areaName: row["Area"]?.trim() || "",
						region: row["Region"]?.trim() || "",
						regionCode: row["Region_Code"]?.trim() || "",
						electorate: parseNumberStrict(row["Electorate"]),
						validVotes: parseNumberStrict(row["Valid_Votes"]),
						remain: parseNumberStrict(row["Remain"]),
						leave: parseNumberStrict(row["Leave"]),
						rejectedBallots: parseNumberStrict(row["Rejected_Ballots"]),
						pctRemain,
						pctLeave,
						pctTurnout: parseNumberStrict(row["Pct_Turnout"]),
					};
					resultMap[areaCode] = pctLeave > 50 ? "leave" : "remain";
				}

				const dataset: BrexitDataset = {
					id: "brexit2016",
					year: 2016,
					type: "brexit",
					boundaryType: "localAuthority",
					boundaryYear: 2023,
					data: records,
					results: resultMap,
				};

				setDatasets({ [dataset.year]: dataset });
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading Brexit data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
