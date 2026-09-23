import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import { releaseKey } from "./geographyKeys";
import type {
	RelationshipPath,
	RelationshipPathInventory,
} from "./relationshipPaths";

export type AnalysisGeographySupport = {
	measureId: string;
	analysisGeography: { geography: string; boundaryRelease: string };
	source: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		periods: string[];
	};
	/** The reviewed crosswalk, when the conversion is one crosswalk. */
	crosswalk?: CrosswalkSummary;
	/** The reviewed published path, when the conversion composes several. */
	path?: AnalysisGeographyPath;
	note: string;
};

type CrosswalkSummary = { id: string; method: string; quality: string };

export type AnalysisGeographyPath = {
	id: string;
	purpose: RelationshipPath["purpose"];
	origin: RelationshipPath["origin"];
	quality: RelationshipPath["quality"];
	steps: Array<{
		crosswalk: CrosswalkSummary;
		direction: RelationshipPath["steps"][number]["direction"];
	}>;
};

export type AnalysisGeographyInventory = {
	schemaVersion: 1;
	contentHash: string;
	dataCatalogHash: string;
	crosswalkInventoryHash: string;
	/** Present only when a support converts through a published path. */
	relationshipPathInventoryHash?: string;
	supports: AnalysisGeographySupport[];
};

/** How a reviewed support converts: one crosswalk, or a published path. */
export const analysisConversion = (support: AnalysisGeographySupport) =>
	support.path
		? {
				id: support.path.id,
				method: "relationship-path",
				quality: support.path.quality,
				steps: support.path.steps,
			}
		: support.crosswalk!;

type SupportConfig = {
	measureId: string;
	analysisGeography: { geography: string; boundaryRelease: string };
	source: { datasetId: string; geography: string; boundaryYear: number };
	/** Exactly one of a crosswalk and a published relationship path. */
	crosswalkId?: string;
	pathId?: string;
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
		(typeof value.crosswalkId === "string") ===
			(typeof value.pathId === "string") ||
		(value.crosswalkId !== undefined && typeof value.crosswalkId !== "string") ||
		(value.pathId !== undefined && typeof value.pathId !== "string") ||
		typeof value.note !== "string" ||
		!isRecord(analysis) ||
		typeof analysis.geography !== "string" ||
		typeof analysis.boundaryRelease !== "string" ||
		!isRecord(source) ||
		typeof source.datasetId !== "string" ||
		typeof source.geography !== "string" ||
		typeof source.boundaryYear !== "number"
	) {
		throw new Error(
			`${path}: invalid analysis-geography support; name exactly one of crosswalkId and pathId.`,
		);
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
		...(typeof value.crosswalkId === "string"
			? { crosswalkId: value.crosswalkId }
			: { pathId: value.pathId as string }),
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
	relationshipPaths?: RelationshipPathInventory,
): AnalysisGeographyInventory => {
	const summaryOf = (id: string): CrosswalkSummary => {
		const crosswalk = crosswalkInventory.crosswalks.find(
			(candidate) => candidate.id === id,
		);
		if (!crosswalk) throw new Error(`${id}: crosswalk is not published.`);
		return { id: crosswalk.id, method: crosswalk.method, quality: crosswalk.quality };
	};
	const supports: AnalysisGeographySupport[] = config.map((configured) => {
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
		// Either route must start on the source geography and end exactly on
		// the declared analysis release.
		const connects = (
			routeId: string,
			from: { geography: string },
			to: { geography: string; boundaryRelease: string },
		) => {
			if (
				from.geography !== source.sourceGeography.type ||
				to.geography !== configured.analysisGeography.geography ||
				to.boundaryRelease !== configured.analysisGeography.boundaryRelease
			)
				throw new Error(`${routeId}: does not connect the declared analysis support.`);
		};
		const base = {
			measureId: configured.measureId,
			analysisGeography: configured.analysisGeography,
			source: { ...configured.source, periods: source.periods },
		};
		if (configured.crosswalkId) {
			const crosswalk = crosswalkInventory.crosswalks.find(
				(candidate) => candidate.id === configured.crosswalkId,
			);
			if (!crosswalk)
				throw new Error(`${configured.crosswalkId}: crosswalk is not published.`);
			connects(configured.crosswalkId, crosswalk.from, crosswalk.to);
			return {
				...base,
				crosswalk: {
					id: crosswalk.id,
					method: crosswalk.method,
					quality: crosswalk.quality,
				},
				note: configured.note,
			};
		}
		const pathId = configured.pathId!;
		if (!relationshipPaths)
			throw new Error(`${pathId}: build the relationship paths before a path-backed analysis support.`);
		const path = relationshipPaths.paths.find((candidate) => candidate.id === pathId);
		if (!path) throw new Error(`${pathId}: relationship path is not published.`);
		connects(pathId, path.from, path.to);
		return {
			...base,
			path: {
				id: path.id,
				purpose: path.purpose,
				origin: path.origin,
				quality: path.quality,
				steps: path.steps.map((step) => ({
					crosswalk: summaryOf(step.crosswalkId),
					direction: step.direction,
				})),
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
		`${left.measureId}/${releaseKey(left.analysisGeography.geography, left.analysisGeography.boundaryRelease)}`.localeCompare(
			`${right.measureId}/${releaseKey(right.analysisGeography.geography, right.analysisGeography.boundaryRelease)}`,
		),
	);
	// The path inventory is an input only when a support uses a path, so an
	// inventory of crosswalk supports does not change when paths do.
	const usesPaths = supports.some((support) => support.path);
	const withoutHash = {
		schemaVersion: 1 as const,
		dataCatalogHash: dataCatalog.contentHash,
		crosswalkInventoryHash: crosswalkInventory.contentHash,
		...(usesPaths && relationshipPaths
			? { relationshipPathInventoryHash: relationshipPaths.contentHash }
			: {}),
		supports,
	};
	return { ...withoutHash, contentHash: sha256(JSON.stringify(withoutHash)) };
};
