// lib/hooks/usePopulationData.ts
"use client";
import { useEffect, useState } from "react";
import { AgeData, PopulationDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

interface CategoryPopulationWardData {
	[wardCode: string]: {
		ageData: AgeData;
		wardName: string;
		laCode: string;
		laName: string;
	};
}

const parsePopulationDataCombined = async (csvText: string) => {
	const malesData: CategoryPopulationWardData = {};
	const femalesData: CategoryPopulationWardData = {};
	const totalData: CategoryPopulationWardData = {};

	// First 3 rows are metadata; row index 0 after skipLines is the header row
	const { data } = await parseCsv<string[]>(csvText, {
		header: false,
		skipLines: 3,
	});

	const rows = data as string[][];
	if (rows.length === 0) return { malesData, femalesData, totalData };

	const headerRow = rows[0];

	// Pre-compute column indices once from the header row
	interface ColMeta { index: number; age: string; sex: "F" | "M" }
	const ageCols: ColMeta[] = [];
	for (let i = 5; i < headerRow.length; i++) {
		const colName = headerRow[i]?.trim() ?? "";
		if (colName.startsWith("F")) {
			ageCols.push({ index: i, age: colName.substring(1), sex: "F" });
		} else if (colName.startsWith("M")) {
			ageCols.push({ index: i, age: colName.substring(1), sex: "M" });
		}
	}

	// Process data rows using pre-indexed columns
	for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
		const row = rows[rowIdx];
		if (!Array.isArray(row) || row.length < 5) continue;

		const laCode = row[0]?.trim();
		const laName = row[1]?.trim() || "";
		const wardCode = row[2]?.trim();
		const wardName = row[3]?.trim() || "";
		if (!laCode || !wardCode) continue;

		const femaleAgeData: AgeData = {};
		const maleAgeData: AgeData = {};
		const totalAgeData: AgeData = {};

		for (const { index, age, sex } of ageCols) {
			const value = row[index]?.trim();
			if (!value || value === "") continue;
			const count = parseInt(value.replace(/,/g, ""), 10);
			if (isNaN(count)) continue;

			if (sex === "F") {
				femaleAgeData[age] = count;
			} else {
				maleAgeData[age] = count;
			}
			totalAgeData[age] = (totalAgeData[age] || 0) + count;
		}

		if (Object.keys(femaleAgeData).length > 0)
			femalesData[wardCode] = { ageData: femaleAgeData, wardName, laCode, laName };
		if (Object.keys(maleAgeData).length > 0)
			malesData[wardCode] = { ageData: maleAgeData, wardName, laCode, laName };
		if (Object.keys(totalAgeData).length > 0)
			totalData[wardCode] = { ageData: totalAgeData, wardName, laCode, laName };
	}

	return { malesData, femalesData, totalData };
};

export const usePopulationData = () => {
	const [datasets, setDatasets] = useState<Record<string, PopulationDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadPopulationData = async () => {
			try {
				const response = await fetch(withCDN("/data/population/Mid-2022 Ward 2023.csv"));
				if (!response.ok)
					throw new Error(`Failed to fetch population data: ${response.statusText}`);

				const { malesData, femalesData, totalData } =
					await parsePopulationDataCombined(await response.text());

				const allWardCodes = new Set([
					...Object.keys(femalesData),
					...Object.keys(malesData),
					...Object.keys(totalData),
				]);

				const combinedData: PopulationDataset["data"] = {};
				for (const wardCode of allWardCodes) {
					combinedData[wardCode] = {
						total: totalData[wardCode]?.ageData || {},
						males: malesData[wardCode]?.ageData || {},
						females: femalesData[wardCode]?.ageData || {},
						wardName: totalData[wardCode]?.wardName || "",
						ladCode: totalData[wardCode]?.laCode || "",
						ladName: totalData[wardCode]?.laName || "",
					};
				}

				setDatasets({
					2022: {
						id: "population2022",
						type: "population",
						year: 2022,
						boundaryYear: 2023,
						boundaryType: "ward",
						data: combinedData,
					},
				});
				setLoading(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load population data");
				setLoading(false);
			}
		};

		loadPopulationData();
	}, []);

	return { datasets, loading, error };
};
