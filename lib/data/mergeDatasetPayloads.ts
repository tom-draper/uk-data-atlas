type DatasetPayload = Record<string, unknown>;

const CODE_KEYED_FIELDS = ["data", "results"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Merge regional dataset payloads while retaining each code-keyed map. */
export const mergeDatasetPayloads = (payloads: unknown[]) => {
	const merged: Record<string, DatasetPayload> = {};
	for (const payload of payloads) {
		if (!isRecord(payload)) continue;
		for (const [datasetId, value] of Object.entries(payload)) {
			if (!isRecord(value)) continue;
			const dataset = value as DatasetPayload;
			const existing = merged[datasetId];
			if (!existing) {
				const copied = { ...dataset };
				for (const field of CODE_KEYED_FIELDS) {
					if (isRecord(dataset[field])) {
						copied[field] = { ...dataset[field] };
					}
				}
				merged[datasetId] = copied;
				continue;
			}
			for (const field of CODE_KEYED_FIELDS) {
				if (!isRecord(dataset[field])) continue;
				existing[field] = {
					...(isRecord(existing[field]) ? existing[field] : {}),
					...dataset[field],
				};
			}
		}
	}
	return merged;
};
