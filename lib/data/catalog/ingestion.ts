import type { DatasetDefinition, DatasetReader } from "./types";

export interface SourceArtifact {
	kind: keyof DatasetReader;
	path: string;
	sha256: string;
	bytes: number;
}

export interface DatasetPrecompileSummary {
	datasetCount: number;
	dataRecordCount: number;
	boundaryYears: number[];
}

type CompiledDataset = {
	type?: unknown;
	boundaryType?: unknown;
	boundaryYear?: unknown;
	data?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

/**
 * Validates the portable output contract shared by every registry dataset.
 * Loader-specific parsing remains local, while accidental empty output, wrong
 * vintage, and missing map values fail the build.
 */
export function validatePrecompiledDataset<
	T extends { type: string; data: unknown },
>(
	definition: DatasetDefinition<T>,
	compiled: Record<string, T>,
): DatasetPrecompileSummary {
	const contract = definition.ingestion;
	const records = Object.values(compiled) as CompiledDataset[];
	const minimumDatasets = contract?.minimumDatasets ?? 1;
	if (records.length < minimumDatasets) {
		throw new Error(
			`${definition.type}: expected at least ${minimumDatasets} dataset record(s), found ${records.length}.`,
		);
	}

	const minimumDataRecords = contract?.minimumDataRecords ?? 1;
	const boundaryYears = new Set<number>();
	let dataRecordCount = 0;

	for (const [key, value] of Object.entries(compiled)) {
		const dataset = value as CompiledDataset;
		if (dataset.type !== definition.type) {
			throw new Error(
				`${definition.type}: ${key} has type ${String(dataset.type)}.`,
			);
		}
		if (dataset.boundaryType !== definition.boundaryType) {
			throw new Error(
				`${definition.type}: ${key} uses ${String(dataset.boundaryType)} boundaries; expected ${definition.boundaryType}.`,
			);
		}
		if (!Number.isInteger(dataset.boundaryYear)) {
			throw new Error(
				`${definition.type}: ${key} has no integer boundaryYear.`,
			);
		}
		boundaryYears.add(dataset.boundaryYear as number);

		const data = asRecord(dataset.data);
		if (!data || Object.keys(data).length < minimumDataRecords) {
			throw new Error(
				`${definition.type}: ${key} contains fewer than ${minimumDataRecords} geography record(s).`,
			);
		}
		dataRecordCount += Object.keys(data).length;
		for (const [code, value] of Object.entries(data)) {
			const record = asRecord(value);
			for (const field of contract?.requiredDataFields ?? []) {
				if (!record || !(field in record)) {
					throw new Error(
						`${definition.type}: ${key}/${code} is missing ${field}.`,
					);
				}
			}
		}
	}

	if (contract?.expectedBoundaryYears) {
		for (const year of boundaryYears) {
			if (!contract.expectedBoundaryYears.includes(year)) {
				throw new Error(
					`${definition.type}: emitted unsupported boundary year ${year}.`,
				);
			}
		}
	}

	return {
		datasetCount: records.length,
		dataRecordCount,
		boundaryYears: [...boundaryYears].sort((a, b) => a - b),
	};
}
