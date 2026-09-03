import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { AggregatedNHSWaitingData, NHSWaitingDataset } from "@/lib/types/nhsWaiting";

/** Aggregates distinct ICB waiting-list records reached by the selected LADs. */
export function aggregateNHSWaiting(
	features: Features,
	codeProperty: PropertyKeys,
	dataset: NHSWaitingDataset,
): AggregatedNHSWaitingData | null {
	const seenIcbs = new Set<string>();
	let total = 0, over18Weeks = 0;

	for (const feature of features) {
		const ladCode = getFeatureProp(feature.properties, codeProperty) ?? "";
		const icbCode = dataset.ladToIcb[ladCode];
		if (!icbCode || seenIcbs.has(icbCode)) continue;
		const record = dataset.data[icbCode];
		if (!record) continue;
		seenIcbs.add(icbCode);
		total += record.total;
		over18Weeks += record.over18Weeks;
	}

	return total === 0 ? null : {
		total,
		over18Weeks,
		pctOver18Weeks: over18Weeks / total * 100,
	};
}
