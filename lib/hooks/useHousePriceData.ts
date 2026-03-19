// lib/hooks/useHousePriceData.ts
import { useState, useEffect } from "react";
import { HousePriceDataset, WardHousePriceData } from "../types";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";

const parsePrice = (value: any): number | null => {
	if (!value || value === "") return null;
	const parsed = parseInt(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? null : parsed;
};

export const useHousePriceData = () => {
	const [datasets, setDatasets] = useState<Record<string, HousePriceDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const res = await fetch(
					withCDN(
						"/data/economics/housing/HPSSA Dataset 37 - Median price paid by wardHPSSA Dataset 37 - Median price paid by ward.csv",
					),
				);
				if (!res.ok)
					throw new Error(`Failed to fetch house price data: ${res.statusText}`);

				const csvText = await res.text();
				const skipLines = findHeaderLine(csvText, "local authority code");
				const { data, fields } = await parseCsv(csvText, {
					header: true,
					skipLines,
				});

				const timePeriodHeaders = fields.slice(4);
				const wardData: Record<string, WardHousePriceData> = {};

				for (const row of data as any[]) {
					const wardCode = row["Ward code"]?.trim();
					if (!wardCode) continue;

					const prices: Record<number, number> = {};
					for (const period of timePeriodHeaders) {
						const price = parsePrice(row[period]);
						if (price !== null) {
							const yearMatch = period.match(/\d{4}/);
							if (yearMatch) prices[parseInt(yearMatch[0])] = price;
						}
					}

					wardData[wardCode] = {
						localAuthorityCode: row["Local authority code"]?.trim() || "",
						localAuthorityName: row["Local authority name"]?.trim() || "",
						wardCode,
						wardName: row["Ward name"]?.trim() || "",
						prices,
					};
				}

				setDatasets({
					2023: {
						id: "housePrice2023",
						type: "housePrice",
						year: 2023,
						boundaryYear: 2021,
						boundaryType: "ward",
						data: wardData,
					},
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading house price data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
