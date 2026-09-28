import { codeKeyedFieldsFor, type DatasetPayloadLayout } from "./catalog/types";

type DatasetPayload = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Merge regional dataset payloads while retaining each code-keyed map. */
export const mergeDatasetPayloads = (
	payloads: unknown[],
	layout?: DatasetPayloadLayout,
) => {
	const merged: Record<string, DatasetPayload> = {};
	const codeKeyedFields = codeKeyedFieldsFor(layout);
	for (const payload of payloads) {
		if (!isRecord(payload)) continue;
		for (const [datasetId, value] of Object.entries(payload)) {
			if (!isRecord(value)) continue;
			const dataset = value as DatasetPayload;
			const existing = merged[datasetId];
			if (!existing) {
				const copied = { ...dataset };
				for (const field of codeKeyedFields) {
					if (isRecord(dataset[field])) {
						copied[field] = { ...dataset[field] };
					}
				}
				merged[datasetId] = copied;
				continue;
			}
			for (const field of codeKeyedFields) {
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
