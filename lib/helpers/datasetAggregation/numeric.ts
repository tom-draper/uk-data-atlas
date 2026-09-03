import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";

/** Collects the numeric dataset records represented by the active boundaries. */
export function collectBoundaryRecords<T>(
	features: Features,
	data: Record<string, T>,
	codeProperty: PropertyKeys,
): T[] {
	const records: T[] = [];
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (record) records.push(record);
	}
	return records;
}
