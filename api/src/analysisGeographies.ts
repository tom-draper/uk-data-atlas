import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";

export type AnalysisGeographySupport = {
	measureId: string;
	analysisGeography: { geography: string; boundaryRelease: string };
	source: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		periods: string[];
	};
	crosswalk: { id: string; method: string; quality: string };
	note: string;
};

export type AnalysisGeographyInventory = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	crosswalkInventoryHash: string;
	supports: AnalysisGeographySupport[];
};

type SupportConfig = {
	measureId: string;
	analysisGeography: { geography: string; boundaryRelease: string };
	source: { datasetId: string; geography: string; boundaryYear: number };
	crosswalkId: string;
	note: string;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const readSupport = (value: unknown, path: string): SupportConfig => {
	if (!isRecord(value)) throw new Error(`${path}: support must be an object.`);
	const analysis = value.analysisGeography;
	const source = value.source;
	if (
		typeof value.measureId !== "string" ||
		typeof value.crosswalkId !== "string" ||
		typeof value.note !== "string" ||
		!isRecord(analysis) ||
		typeof analysis.geography !== "string" ||
		typeof analysis.boundaryRelease !== "string" ||
		!isRecord(source) ||
		typeof source.datasetId !== "string" ||
		typeof source.geography !== "string" ||
		typeof source.boundaryYear !== "number"
	) {
		throw new Error(`${path}: invalid analysis-geography support.`);
	}
	return {
		measureId: value.measureId,
		analysisGeography: {
			geography: analysis.geography,
			boundaryRelease: analysis.boundaryRelease,
		},
		source: {
			datasetId: source.datasetId,
			geography: source.geography,
			boundaryYear: source.boundaryYear,
		},
		crosswalkId: value.crosswalkId,
		note: value.note,
	};
};

export const readAnalysisGeographySupport = (path: string): SupportConfig[] => {
	const file = JSON.parse(readFileSync(path, "utf8")) as unknown;
	if (!isRecord(file) || file.schemaVersion !== 1 || !Array.isArray(file.supports))
		throw new Error(`Invalid analysis geography configuration at ${path}.`);
	return file.supports.map((support, index) =>
		readSupport(support, `${path} support ${index}`),
	);
};

/**
 * Publishes only the measure/frame pairs that have been reviewed in advance.
 * A crosswalk existing in the catalogue is not enough: the configured source
 * must be extensive and every endpoint must name the exact source partition.
 */
export const compileAnalysisGeographies = (
	config: SupportConfig[],
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyInventory => {
	const supports = config.map((configured) => {
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === configured.measureId,
		);
		if (!measure) throw new Error(`${configured.measureId}: measure is not published.`);
		if (measure.aggregation.kind !== "extensive")
			throw new Error(`${configured.measureId}: only extensive measures may be analysis conversions.`);
		const source = measure.sources.find(
			(candidate) =>
				candidate.datasetId === configured.source.datasetId &&
				candidate.sourceGeography.type === configured.source.geography &&
				candidate.sourceGeography.boundaryYear === configured.source.boundaryYear,
		);
		if (!source)
			throw new Error(
				`${configured.measureId}: ${configured.source.datasetId} is not published on ${configured.source.geography} ${configured.source.boundaryYear}.`,
			);
		const crosswalk = crosswalkInventory.crosswalks.find(
			(candidate) => candidate.id === configured.crosswalkId,
		);
		if (!crosswalk)
			throw new Error(`${configured.crosswalkId}: crosswalk is not published.`);
		if (
			crosswalk.from.geography !== source.sourceGeography.type ||
			crosswalk.to.geography !== configured.analysisGeography.geography ||
			crosswalk.to.boundaryRelease !== configured.analysisGeography.boundaryRelease
		)
			throw new Error(`${configured.crosswalkId}: does not connect the declared analysis support.`);
		return {
			measureId: configured.measureId,
			analysisGeography: configured.analysisGeography,
			source: { ...configured.source, periods: source.periods },
			crosswalk: {
				id: crosswalk.id,
				method: crosswalk.method,
				quality: crosswalk.quality,
			},
			note: configured.note,
		};
	});
	const duplicate = supports.find(
		(support, index) =>
			supports.findIndex(
				(candidate) =>
					candidate.measureId === support.measureId &&
					candidate.analysisGeography.geography === support.analysisGeography.geography &&
					candidate.analysisGeography.boundaryRelease === support.analysisGeography.boundaryRelease &&
					candidate.source.datasetId === support.source.datasetId,
			) !== index,
	);
	if (duplicate) throw new Error(`Duplicate analysis support for ${duplicate.measureId}.`);
	supports.sort((left, right) =>
		`${left.measureId}/${left.analysisGeography.geography}/${left.analysisGeography.boundaryRelease}`.localeCompare(
			`${right.measureId}/${right.analysisGeography.geography}/${right.analysisGeography.boundaryRelease}`,
		),
	);
	const withoutHash = {
		schemaVersion: 1 as const,
		dataCatalogHash: dataCatalog.contentHash,
		crosswalkInventoryHash: crosswalkInventory.contentHash,
		supports,
	};
	return { ...withoutHash, contentHash: sha256(JSON.stringify(withoutHash)) };
};
