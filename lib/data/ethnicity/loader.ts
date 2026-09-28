import { EthnicityCategory, EthnicityDataset } from "@/lib/types/ethnicity";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableInt } from "@/lib/helpers/parseNumber";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

type EthnicityData = Record<string, Record<string, EthnicityCategory>>;

/**
 * 2023 unitary-authority mergers whose predecessor districts are the units in
 * the 2021 Census ethnicity release. The ONS documents these exact code
 * changes in its population estimates methods guide:
 * https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/methodologies/populationestimatesforenglandandwalesmid2022methodsguide
 */
export const ETHNICITY_LAD_PREDECESSORS: Record<string, readonly string[]> =
	Object.fromEntries(
		Object.entries(APRIL_2023_LAD_MERGERS).map(
			([target, { predecessors }]) => [target, predecessors],
		),
	);

/** Add derived 2023 authority records by summing every census category. */
export function addMergedEthnicityAuthorities(data: EthnicityData): void {
	for (const [target, predecessors] of Object.entries(
		ETHNICITY_LAD_PREDECESSORS,
	)) {
		// Prefer a native record should a future source publish the new code.
		if (data[target]) continue;

		const merged: Record<string, EthnicityCategory> = {};
		for (const predecessor of predecessors) {
			const categories = data[predecessor];
			if (!categories) {
				throw new Error(
					`Missing ethnicity predecessor ${predecessor} for ${target}`,
				);
			}
			for (const [parent, subcategories] of Object.entries(categories)) {
				const targetCategories = (merged[parent] ??= {});
				for (const [subcategory, value] of Object.entries(
					subcategories,
				)) {
					const existing = targetCategories[subcategory];
					if (existing) existing.population += value.population;
					else targetCategories[subcategory] = { ...value };
				}
			}
		}
		data[target] = merged;
	}
}

function parseEthnicityName(fullName: string): {
	parent: string;
	subcategory: string;
} {
	const colonIndex = fullName.indexOf(":");
	if (colonIndex !== -1) {
		return {
			parent: fullName.substring(0, colonIndex).trim(),
			subcategory: fullName.substring(colonIndex + 1).trim(),
		};
	}
	return { parent: fullName.trim(), subcategory: fullName.trim() };
}

function calculateResults(
	localAuthorityData: Record<string, Record<string, EthnicityCategory>>,
): Record<string, string> {
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
}

export async function loadEthnicity(
	read: (path: string) => Promise<string>,
): Promise<Record<string, EthnicityDataset>> {
	const { data } = await parseCsv(
		await read(
			"demographics/ethnicity/ts021-ethnic-group/TS021-2021-3.csv",
		),
		{ header: true },
	);

	const localAuthorityData: EthnicityData = {};

	for (const row of data) {
		const localAuthorityCode =
			row["Lower tier local authorities Code"]?.trim();
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

	addMergedEthnicityAuthorities(localAuthorityData);

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
}
