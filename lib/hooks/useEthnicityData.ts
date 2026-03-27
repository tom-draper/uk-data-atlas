// lib/hooks/useEthnicityData.ts
import { useState, useEffect } from "react";
import { EthnicityCategory, EthnicityDataset } from "../types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

const parseObservation = (value: any): number | null => {
	if (!value || value === "") return null;
	const parsed = parseInt(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? null : parsed;
};

const parseEthnicityName = (fullName: string): { parent: string; subcategory: string } => {
	const colonIndex = fullName.indexOf(":");
	if (colonIndex !== -1) {
		return {
			parent: fullName.substring(0, colonIndex).trim(),
			subcategory: fullName.substring(colonIndex + 1).trim(),
		};
	}
	return { parent: fullName.trim(), subcategory: fullName.trim() };
};

const calculateResults = (
	localAuthorityData: Record<string, Record<string, EthnicityCategory>>,
): Record<string, string> => {
	const results: Record<string, string> = {};
	for (const [code, parentCategories] of Object.entries(localAuthorityData)) {
		let maxPopulation = 0;
		let majoritySubcategory = "NONE";
		for (const subcategories of Object.values(parentCategories)) {
			for (const [subcategoryName, data] of Object.entries(subcategories)) {
				if (data.population > maxPopulation) {
					maxPopulation = data.population;
					majoritySubcategory = subcategoryName;
				}
			}
		}
		results[code] = majoritySubcategory;
	}
	return results;
};

export const useEthnicityData = () => {
	const [datasets, setDatasets] = useState<Record<string, EthnicityDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const res = await fetch(withCDN("/data/ethnicity/TS021-2021-2.csv"));
				if (!res.ok) throw new Error(`Failed to fetch ethnicity data: ${res.statusText}`);

				const { data } = await parseCsv(await res.text(), { header: true });

				const localAuthorityData: Record<string, Record<string, any>> = {};

				for (const row of data as any[]) {
					const localAuthorityCode = row["Lower Tier Local Authorities Code"]?.trim();
					const ethnicGroupCode = row["Ethnic group (20 categories) Code"]?.trim();
					if (!localAuthorityCode || !ethnicGroupCode) continue;
					if (ethnicGroupCode === "-8") continue;

					if (!localAuthorityData[localAuthorityCode]) {
						localAuthorityData[localAuthorityCode] = {};
					}

					const fullName = row["Ethnic group (20 categories)"]?.trim() || "";
					const { parent, subcategory } = parseEthnicityName(fullName);
					const observation = parseObservation(row["Observation"]);

					if (observation !== null) {
						if (!localAuthorityData[localAuthorityCode][parent]) {
							localAuthorityData[localAuthorityCode][parent] = {};
						}
						localAuthorityData[localAuthorityCode][parent][subcategory] = {
							ethnicity: subcategory,
							population: observation,
							code: ethnicGroupCode,
						};
					}
				}

				const results = calculateResults(localAuthorityData);

				setDatasets({
					2021: {
						id: "ethnicity2021",
						type: "ethnicity",
						year: 2021,
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						data: localAuthorityData,
						results,
					},
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading ethnicity data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
