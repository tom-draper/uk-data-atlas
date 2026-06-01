import { EthnicityCategory, EthnicityDataset } from "../types/ethnicity";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNullableInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

const parseEthnicityName = (
	fullName: string,
): { parent: string; subcategory: string } => {
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
			for (const [subcategoryName, data] of Object.entries(
				subcategories,
			)) {
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

export const useEthnicityData = (enabled = true) => {
	return useDataLoader<EthnicityDataset>(async () => {
		const res = await fetch(withCDN("/data/demographics/ethnicity/TS021-2021-2.csv"));
		if (!res.ok)
			throw new Error(
				`Failed to fetch ethnicity data: ${res.statusText}`,
			);

		const { data } = await parseCsv(await res.text(), { header: true });

		const localAuthorityData: Record<string, Record<string, any>> = {};

		for (const row of data as any[]) {
			const localAuthorityCode =
				row["Lower Tier Local Authorities Code"]?.trim();
			const ethnicGroupCode =
				row["Ethnic group (20 categories) Code"]?.trim();
			if (!localAuthorityCode || !ethnicGroupCode) continue;
			if (ethnicGroupCode === "-8") continue;

			if (!localAuthorityData[localAuthorityCode]) {
				localAuthorityData[localAuthorityCode] = {};
			}

			const fullName = row["Ethnic group (20 categories)"]?.trim() || "";
			const { parent, subcategory } = parseEthnicityName(fullName);
			const observation = parseNullableInt(row["Observation"]);

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

		return {
			2021: {
				id: "ethnicity2021",
				type: "ethnicity",
				year: 2021,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data: localAuthorityData,
				results,
			},
		};
	}, enabled);
};
