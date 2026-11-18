import type { EthnicityCategory, Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { EthnicityDataset } from "@uk-data-atlas/datasets";

export function aggregateCategories(
	features: Features,
	codeProperty: PropertyKeys,
	data: EthnicityDataset["data"],
): Record<string, EthnicityCategory> {
	const aggregated: Record<
		string,
		Record<string, { population: number; code: string }>
	> = {};
	for (const feature of features) {
		const localAuthority =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!localAuthority) continue;
		for (const [parentCategory, subcategories] of Object.entries(
			localAuthority,
		)) {
			const parent = (aggregated[parentCategory] ??= {});
			for (const [subcategoryName, ethnicity] of Object.entries(
				subcategories,
			)) {
				const subcategory = (parent[subcategoryName] ??= {
					population: 0,
					code: ethnicity.code,
				});
				subcategory.population += ethnicity.population;
			}
		}
	}

	const result: Record<string, EthnicityCategory> = {};
	for (const [parentCategory, subcategories] of Object.entries(aggregated)) {
		result[parentCategory] = {};
		for (const [subcategoryName, ethnicity] of Object.entries(
			subcategories,
		)) {
			result[parentCategory][subcategoryName] = {
				ethnicity: subcategoryName,
				population: ethnicity.population,
				code: ethnicity.code,
			};
		}
	}
	return result;
}
