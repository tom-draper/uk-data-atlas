import type {
	AggregatedCrimeData,
	AggregatedCustomData,
	CrimeDataset,
	Features,
	PropertyKeys,
} from "@/lib/types";
import { getFeatureProp } from "@/lib/types";

export function aggregateCustomDataset(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, number>,
): AggregatedCustomData {
	let sum = 0,
		count = 0;
	for (const feature of features) {
		const value =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (typeof value === "number") {
			sum += value;
			count++;
		}
	}
	return { count, average: count > 0 ? sum / count : 0 };
}
