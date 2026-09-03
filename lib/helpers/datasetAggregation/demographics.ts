import type { EthnicityCategory, Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { EthnicityDataset } from "@/lib/types/ethnicity";
import type { AggregatedLifeExpectancyData, LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import type {
	AggregatedQualificationData,
	QualificationBreakdown,
	QualificationDataset,
} from "@/lib/types/qualification";

export function aggregateEthnicity(
	features: Features,
	codeProperty: PropertyKeys,
	data: EthnicityDataset["data"],
): Record<string, EthnicityCategory> {
	const aggregated: Record<string, Record<string, { population: number; code: string }>> = {};
	for (const feature of features) {
		const localAuthority = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!localAuthority) continue;
		for (const [parentCategory, subcategories] of Object.entries(localAuthority)) {
			const parent = aggregated[parentCategory] ??= {};
			for (const [subcategoryName, ethnicity] of Object.entries(subcategories)) {
				const subcategory = parent[subcategoryName] ??= {
					population: 0,
					code: ethnicity.code,
				};
				subcategory.population += ethnicity.population;
			}
		}
	}

	const result: Record<string, EthnicityCategory> = {};
	for (const [parentCategory, subcategories] of Object.entries(aggregated)) {
		result[parentCategory] = {};
		for (const [subcategoryName, ethnicity] of Object.entries(subcategories)) {
			result[parentCategory][subcategoryName] = {
				ethnicity: subcategoryName,
				population: ethnicity.population,
				code: ethnicity.code,
			};
		}
	}
	return result;
}

export function aggregateLifeExpectancy(
	features: Features,
	codeProperty: PropertyKeys,
	data: LifeExpectancyDataset["data"],
): AggregatedLifeExpectancyData {
	let male = 0, female = 0, count = 0;
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		male += record.maleBirthLE;
		female += record.femaleBirthLE;
		count++;
	}
	return {
		averageMaleLE: count > 0 ? male / count : 0,
		averageFemaleLE: count > 0 ? female / count : 0,
	};
}

export function aggregateQualifications(
	features: Features,
	codeProperty: PropertyKeys,
	data: QualificationDataset["data"],
): AggregatedQualificationData {
	const seen = new Set<string>();
	const total: QualificationBreakdown = {
		noQualifications: 0,
		level1: 0,
		level2: 0,
		apprenticeship: 0,
		level3: 0,
		level4Plus: 0,
		other: 0,
		total: 0,
	};
	for (const feature of features) {
		const code = getFeatureProp(feature.properties, codeProperty) ?? "";
		if (seen.has(code)) continue;
		seen.add(code);
		const breakdown = data[code]?.breakdown;
		if (!breakdown) continue;
		total.noQualifications += breakdown.noQualifications;
		total.level1 += breakdown.level1;
		total.level2 += breakdown.level2;
		total.apprenticeship += breakdown.apprenticeship;
		total.level3 += breakdown.level3;
		total.level4Plus += breakdown.level4Plus;
		total.other += breakdown.other;
		total.total += breakdown.total;
	}
	return { breakdown: total };
}
