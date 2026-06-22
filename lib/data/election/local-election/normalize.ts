// lib/data/election/local-election/normalize.ts
// Client-safe ward-code normalization (no PapaParse dependency) so it can run
// in the browser against live boundary data.
import { LocalElectionDataset } from "@lib/types/index";

/**
 * Remap any ward codes in a dataset that don't exist in the expected boundary
 * year's code set. Uses the cross-year code mapper as an automatic fallback,
 * covering cases where the source data carries codes from a different boundary
 * revision than the GeoJSON the dataset is paired with.
 */
export const normalizeElectionDatasetCodes = (
	dataset: LocalElectionDataset,
	validWardCodes: Set<string>,
	getCodeForYear: (
		type: "ward",
		code: string,
		targetYear: number,
	) => string | undefined,
): LocalElectionDataset => {
	const { boundaryYear } = dataset;
	const remapped: Record<string, string> = {};

	for (const code of Object.keys(dataset.results)) {
		if (!validWardCodes.has(code)) {
			const mapped = getCodeForYear("ward", code, boundaryYear);
			if (mapped && validWardCodes.has(mapped)) {
				remapped[code] = mapped;
			}
		}
	}

	if (Object.keys(remapped).length === 0) return dataset;

	const newResults = { ...dataset.results };
	const newData = { ...dataset.data };

	for (const [oldCode, newCode] of Object.entries(remapped)) {
		if (newResults[oldCode] !== undefined) {
			newResults[newCode] = newResults[oldCode];
			delete newResults[oldCode];
		}
		if (newData[oldCode] !== undefined) {
			newData[newCode] = { ...newData[oldCode], wardCode: newCode };
			delete newData[oldCode];
		}
	}

	return { ...dataset, results: newResults, data: newData };
};
