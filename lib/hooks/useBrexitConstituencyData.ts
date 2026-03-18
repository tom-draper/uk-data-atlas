// lib/hooks/useBrexitConstituencyData.ts
import { useState, useEffect } from "react";
import Papa from "papaparse";
import { BrexitConstituencyDataset, BrexitConstituencyData } from "@lib/types";
import { withCDN } from "../helpers/cdn";

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
				if (!response.ok) {
					throw new Error(
						`Failed to fetch Brexit constituency data: ${response.statusText}`,
					);
				}

				const csvText = await response.text();

				Papa.parse(csvText, {
					header: false,
					skipEmptyLines: true,
					complete: (results: any) => {
						try {
							const rows: string[][] = results.data;

							const records: Record<string, BrexitConstituencyData> = {};
							const resultMap: Record<string, "remain" | "leave"> = {};

							for (const row of rows) {
								// Data rows have an ONS code (E14...) in col 1
								const code = row[1]?.trim() || "";
								if (!code.startsWith("E14")) continue;

								const pctLeave = parsePct(row[6]); // "FIGURE TO USE" column
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
						} catch (parseErr: any) {
							setError(parseErr.message || "Error parsing Brexit constituency data");
							setLoading(false);
						}
					},
					error: (parseError: any) => {
						setError(`CSV parsing error: ${parseError.message}`);
						setLoading(false);
					},
				});
			} catch (err: any) {
				setError(err.message || "Error loading Brexit constituency data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
