// lib/hooks/useBrexitConstituencyData.ts
import { useState, useEffect } from "react";
import { BrexitConstituencyDataset, BrexitConstituencyData } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

const parsePct = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const cleaned = val.replace(/%/g, "").trim();
	const parsed = Number(cleaned);
	return isNaN(parsed) ? 0 : parsed;
};

export const useBrexitConstituencyData = () => {
	const [datasets, setDatasets] = useState<Record<string, BrexitConstituencyDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const response = await fetch(
					withCDN("/data/referendum/eureferendum_constitunecy.csv"),
				);
				if (!response.ok)
					throw new Error(`Failed to fetch Brexit constituency data: ${response.statusText}`);

				const { data } = await parseCsv<string[]>(await response.text(), {
					header: false,
				});

				const records: Record<string, BrexitConstituencyData> = {};
				const resultMap: Record<string, "remain" | "leave"> = {};

				for (const row of data as string[][]) {
					const code = row[1]?.trim() || "";
					if (!code.startsWith("E14")) continue;

					const pctLeave = parsePct(row[6]);
					const isKnownResult = row[4]?.trim().toLowerCase() === "yes";

					records[code] = {
						constituencyCode: code,
						constituencyName: row[2]?.trim() || "",
						pctLeave,
						isKnownResult,
					};
					resultMap[code] = pctLeave > 50 ? "leave" : "remain";
				}

				const dataset: BrexitConstituencyDataset = {
					id: "brexitConstituency2016",
					year: 2016,
					type: "brexitConstituency",
					boundaryType: "constituency",
					boundaryYear: 2015,
					data: records,
					results: resultMap,
				};

				setDatasets({ [dataset.year]: dataset });
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading Brexit constituency data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
