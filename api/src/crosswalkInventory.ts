import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileAreaOverlapCrosswalk } from "./areaOverlap";
import { compileGeometricContainmentCrosswalk } from "./geometricContainment";
import { compilePopulationOverlapCrosswalk } from "./populationOverlap";
import { compileSameCodeContinuityCrosswalk } from "./sameCodeContinuity";
import {
	validateGeometryContainment,
	type GeometryContainmentValidation,
} from "./crosswalkGeometryValidation";
import type {
	AreaOverlapWeighting,
	CrosswalkAdapter,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkSideAdapter,
	CrosswalkWeighting,
	GeometricContainmentCrosswalkAdapter,
	PopulationOverlapWeighting,
	PropertyCrosswalkAdapter,
	SameCodeContinuityCrosswalkAdapter,
} from "./crosswalkAdapters";
import {
	validateEndpoint,
	type CrosswalkEndpointValidation,
} from "./crosswalkValidation";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { AreaLookup } from "./areaInventory";
import type { GeometryProvenance } from "./reprojection";

export type {
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkAdapters";
export type { CrosswalkEndpointValidation } from "./crosswalkValidation";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

export type CrosswalkArea = {
	code: string;
	labels: string[];
};

export type AreaOverlapSource = CrosswalkArea & {
	areaM2: number;
	/** Share of the source's area covered by its published targets. */
	coverage: number;
};

export type AreaOverlapTarget = CrosswalkArea & {
	/** Share of the source's covered area; a record's weights sum to 1. */
	weight: number;
	overlapAreaM2: number;
	/** Overlap area as a share of the whole source area. */
	sourceShare: number;
	/** Overlap area as a share of the whole target area. */
	targetShare: number;
};

export type AreaOverlapValidation = {
	candidatePairCount: number;
	intersectingPairCount: number;
	sliverPairCount: number;
	sliverWidthM: number;
	widestSliverWidthM: number | null;
	narrowestOverlapWidthM: number;
	minimumCoverage: number;
	minimumSourceCoverage: number;
	minimumTargetCoverage: number;
};

type CrosswalkEndpoints = {
	from: CrosswalkEndpointValidation;
	to: CrosswalkEndpointValidation;
};

type CrosswalkArtifactBase = {
	schemaVersion: 1;
	contentHash: string;
	id: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	relationshipPurpose?: "identity" | "membership";
};

export type PropertyCrosswalkArtifact = CrosswalkArtifactBase & {
	method: PropertyCrosswalkAdapter["method"];
	quality: PropertyCrosswalkAdapter["quality"];
	weighting: PropertyCrosswalkAdapter["weighting"];
	provenance: { input: string; inputHash: string };
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		/** Independent geometry check for published clean-containment mappings. */
		geometryContainment?: GeometryContainmentValidation;
	};
	records: Array<{ source: CrosswalkArea; targets: CrosswalkArea[] }>;
};

export type AreaOverlapCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "area-overlap";
	quality: "derived";
	weighting: AreaOverlapWeighting;
	provenance: {
		inputs: Array<
			{
				side: "from" | "to";
				input: string;
				inputHash: string;
				sourceCodePattern?: string;
			} & GeometryProvenance
		>;
		areaProjection: "EPSG:6933";
		clipping: string;
	};
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		overlap: AreaOverlapValidation;
	};
	records: Array<{ source: AreaOverlapSource; targets: AreaOverlapTarget[] }>;
};

export type PopulationOverlapValidation = {
	minimumCoverage: number;
	blockCount: number;
	/** Every block's count, and where it went: kept pairs, slivers, outside. */
	blockPopulation: number;
	assignedPopulation: number;
	/** People in a source but in no kept pair: where borders disagree. */
	sliverPopulation: number;
	/** People in blocks outside every source the adapter admits. */
	outsidePopulation: number;
	/** Blocks the clipper could not measure, and their population. */
	unmeasuredBlocks: Array<{ code: string; population: number; reason: string }>;
	minimumSourceCoverage: number;
};

export type PopulationOverlapCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "population-overlap";
	quality: "derived";
	weighting: PopulationOverlapWeighting;
	provenance: {
		pairs: { crosswalkId: string; contentHash: string };
		inputs: AreaOverlapCrosswalkArtifact["provenance"]["inputs"];
		blocks: { input: string; inputHash: string } & GeometryProvenance;
		population: {
			input: string;
			inputHash: string;
			codeColumn: string;
			valueColumn: string;
		};
		areaProjection: "EPSG:6933";
		clipping: string;
	};
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		population: PopulationOverlapValidation;
	};
	records: Array<{
		source: CrosswalkArea & {
			population: number;
			/** Share of the source's population in its published targets. */
			coverage: number;
		};
		targets: Array<
			CrosswalkArea & {
				/** Share of the source's covered population; weights sum to 1. */
				weight: number;
				population: number;
				/** The pair's population as a share of the source's. */
				sourceShare: number;
				/** The pair's population as a share of the target's, from every source. */
				targetShare: number;
				/** The pair's area, from the area-overlap crosswalk it reweights. */
				overlapAreaM2: number;
			}
		>;
	}>;
};

export type GeometricContainmentValidation = {
	sliverWidthM: number;
	childCount: number;
	parentCount: number;
	childlessParentCount: number;
	/** The smallest share of any child's area inside its parent. */
	minimumContainedShare: number;
	/** The widest piece any child leaves outside its parent, in metres. */
	widestOutsideM: number;
};

export type GeometricContainmentCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "geometric-containment";
	quality: "derived";
	relationshipPurpose: "membership";
	weighting: GeometricContainmentCrosswalkAdapter["weighting"];
	provenance: AreaOverlapCrosswalkArtifact["provenance"];
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		containment: GeometricContainmentValidation;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<
			CrosswalkArea & {
				/** Share of the child's area inside this parent. */
				containedShare: number;
				/** Width of the widest piece it leaves outside, in metres. */
				outsideWidthM: number;
			}
		>;
	}>;
};

export type SameCodeContinuityValidation = {
	sliverWidthM: number;
	sourceAreaCount: number;
	targetAreaCount: number;
	/** Codes present in both releases, whether or not published. */
	sharedCodeCount: number;
	/** Shared codes whose extent held, which are the published records. */
	continuousCount: number;
	/**
	 * Shared codes left out because their geometries differ by more than
	 * slivers: `changed` beyond twice the sliver width, `indeterminate` within
	 * a factor of two of it, where the build will not decide.
	 */
	changedExtent: Array<{
		code: string;
		relation: "changed" | "indeterminate";
		/** Width of the difference's widest piece, twice area over perimeter. */
		widestDifferenceM: number;
		sourceShare: number;
		targetShare: number;
	}>;
	/** Shared codes the clipper could not intersect, so not published. */
	unmeasured: Array<{ code: string; reason: string }>;
};

export type SameCodeContinuityCrosswalkArtifact = CrosswalkArtifactBase & {
	method: "same-code-continuity";
	quality: "derived";
	relationshipPurpose: "identity";
	weighting: SameCodeContinuityCrosswalkAdapter["weighting"];
	provenance: AreaOverlapCrosswalkArtifact["provenance"];
	validation: {
		sourceNameConflicts: Array<{ code: string; names: string[] }>;
		endpoints: CrosswalkEndpoints;
		continuity: SameCodeContinuityValidation;
	};
	records: Array<{
		source: CrosswalkArea;
		targets: Array<
			CrosswalkArea & {
				/** Width of the difference's widest piece, in metres. */
				widestDifferenceM: number;
				/** Overlap as a share of the source area. */
				sourceShare: number;
				/** Overlap as a share of the target area. */
				targetShare: number;
			}
		>;
	}>;
};

export type CrosswalkArtifact =
	| PropertyCrosswalkArtifact
	| AreaOverlapCrosswalkArtifact
	| PopulationOverlapCrosswalkArtifact
	| GeometricContainmentCrosswalkArtifact
	| SameCodeContinuityCrosswalkArtifact;

export type CrosswalkInventory = {
	schemaVersion: 1;
	contentHash: string;
	crosswalks: Array<{
		id: string;
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		method: CrosswalkMethod;
		quality: CrosswalkQuality;
		relationshipPurpose?: "identity" | "membership";
		weighting: CrosswalkWeighting;
		recordCount: number;
		artifact: string;
		contentHash: string;
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const stringValue = (value: unknown, description: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Missing ${description}`);
	}
	return value.trim();
};

const area = (
	properties: Record<string, unknown>,
	side: CrosswalkSideAdapter,
	input: string,
	index: number,
): CrosswalkArea => {
	const code = stringValue(
		properties[side.codeProperty],
		`${side.codeProperty} at ${input} feature ${index}`,
	);
	const name = stringValue(
		properties[side.nameProperty],
		`${side.nameProperty} at ${input} feature ${index}`,
	);
	const alias = side.aliasProperty
		? properties[side.aliasProperty]
		: undefined;
	return {
		code,
		labels: [name, ...(typeof alias === "string" ? [alias.trim()] : [])]
			.filter(Boolean)
			.sort(),
	};
};

const mergeArea = (
	left: CrosswalkArea,
	right: CrosswalkArea,
): CrosswalkArea => ({
	code: left.code,
	labels: [...new Set([...left.labels, ...right.labels])].sort(),
});

const compilePropertyCrosswalk = (
	repositoryRoot: string,
	adapter: PropertyCrosswalkAdapter,
	areaLookup: AreaLookup | undefined,
	geometrySources: GeometrySourceLookup | undefined,
): PropertyCrosswalkArtifact => {
	const inputPath = join(repositoryRoot, "data", adapter.input);
	const input = readFileSync(inputPath, "utf8");
	const source = JSON.parse(input) as FeatureCollection;
	if (
		source.type !== "FeatureCollection" ||
		!Array.isArray(source.features)
	) {
		throw new Error(
			`${adapter.id}: input is not a GeoJSON FeatureCollection`,
		);
	}
	const records = new Map<
		string,
		{ source: CrosswalkArea; targets: Map<string, CrosswalkArea> }
	>();
	const sourcePrimaryNames = new Map<string, Set<string>>();
	for (const [index, feature] of source.features.entries()) {
		if (
			typeof feature.properties !== "object" ||
			feature.properties === null
		) {
			throw new Error(
				`${adapter.id}: feature ${index} has no properties`,
			);
		}
		const properties = feature.properties as Record<string, unknown>;
		const sourceArea = area(properties, adapter.from, adapter.id, index);
		const targetArea = area(properties, adapter.to, adapter.id, index);
		const sourceName = stringValue(
			properties[adapter.from.nameProperty],
			`${adapter.from.nameProperty} at ${adapter.id} feature ${index}`,
		);
		const names =
			sourcePrimaryNames.get(sourceArea.code) ?? new Set<string>();
		names.add(sourceName);
		sourcePrimaryNames.set(sourceArea.code, names);
		const record = records.get(sourceArea.code);
		const targets = record?.targets ?? new Map<string, CrosswalkArea>();
		const existingTarget = targets.get(targetArea.code);
		targets.set(
			targetArea.code,
			existingTarget ? mergeArea(existingTarget, targetArea) : targetArea,
		);
		records.set(sourceArea.code, {
			source: record ? mergeArea(record.source, sourceArea) : sourceArea,
			targets,
		});
	}
	const sourceNameConflicts = [...sourcePrimaryNames.entries()]
		.filter(([, names]) => names.size > 1)
		.map(([code, names]) => ({ code, names: [...names].sort() }))
		.sort((left, right) => left.code.localeCompare(right.code));
	const endpoints = {
		from: validateEndpoint(
			adapter.id,
			"from",
			adapter.from,
			new Set(records.keys()),
			areaLookup,
		),
		to: validateEndpoint(
			adapter.id,
			"to",
			adapter.to,
			new Set(
				[...records.values()].flatMap((record) => [
					...record.targets.keys(),
				]),
			),
			areaLookup,
		),
	};
	const compiledRecords = [...records.values()]
		.map((record) => ({
			source: record.source,
			targets: [...record.targets.values()].sort((left, right) =>
				left.code.localeCompare(right.code),
			),
		}))
		.sort((left, right) => left.source.code.localeCompare(right.source.code));
	const geometryContainment =
		adapter.method === "clean-containment"
			? validateGeometryContainment(repositoryRoot, geometrySources, {
					crosswalkId: adapter.id,
					from: adapter.from,
					to: adapter.to,
					records: compiledRecords,
				})
			: undefined;
	const artifactWithoutHash = {
		schemaVersion: 1 as const,
		id: adapter.id,
		method: adapter.method,
		quality: adapter.quality,
		...(adapter.relationshipPurpose === undefined
			? {}
			: { relationshipPurpose: adapter.relationshipPurpose }),
		weighting: adapter.weighting,
		from: {
			geography: adapter.from.geography,
			boundaryRelease: adapter.from.boundaryRelease,
		},
		to: {
			geography: adapter.to.geography,
			boundaryRelease: adapter.to.boundaryRelease,
		},
		provenance: { input: adapter.input, inputHash: sha256(input) },
		validation: {
			sourceNameConflicts,
			endpoints,
			...(geometryContainment ? { geometryContainment } : {}),
		},
		records: compiledRecords,
	};
	return {
		...artifactWithoutHash,
		contentHash: sha256(JSON.stringify(artifactWithoutHash)),
	};
};

/**
 * Compile adapters in order. A population overlap reweights an area overlap,
 * so it reads that artifact from the ones compiled before it or from `prior`,
 * the artifacts a build reuses rather than recompiles.
 */
export const compileCrosswalks = (
	repositoryRoot: string,
	adapters: CrosswalkAdapter[],
	areaLookup?: AreaLookup,
	geometrySources?: GeometrySourceLookup,
	prior: ReadonlyMap<string, CrosswalkArtifact> = new Map(),
): { inventory: CrosswalkInventory; artifacts: CrosswalkArtifact[] } => {
	const compiled = new Map(prior);
	const artifacts = adapters.map((adapter): CrosswalkArtifact => {
		const artifact = ((): CrosswalkArtifact => {
			if (
				adapter.method === "official-lookup" ||
				adapter.method === "clean-containment"
			) {
				return compilePropertyCrosswalk(
					repositoryRoot,
					adapter,
					areaLookup,
					geometrySources,
				);
			}
			if (!geometrySources) {
				throw new Error(
					`${adapter.id}: ${adapter.method} crosswalks need the geometry source registry.`,
				);
			}
			if (adapter.method === "geometric-containment") {
				return compileGeometricContainmentCrosswalk(
					repositoryRoot,
					adapter,
					geometrySources,
					areaLookup,
				);
			}
			if (adapter.method === "same-code-continuity") {
				return compileSameCodeContinuityCrosswalk(
					repositoryRoot,
					adapter,
					geometrySources,
					areaLookup,
				);
			}
			if (adapter.method === "population-overlap") {
				return compilePopulationOverlapCrosswalk(
					repositoryRoot,
					adapter,
					geometrySources,
					areaLookup,
					compiled.get(adapter.pairs),
				);
			}
			if (adapter.method === "area-overlap") {
				return compileAreaOverlapCrosswalk(
					repositoryRoot,
					adapter,
					geometrySources,
					areaLookup,
				);
			}
			throw new Error(`${adapter.id}: no compiler for ${adapter.method}.`);
		})();
		compiled.set(artifact.id, artifact);
		return artifact;
	});
	return { inventory: createCrosswalkInventory(artifacts), artifacts };
};

export const createCrosswalkInventory = (
	artifacts: CrosswalkArtifact[],
): CrosswalkInventory => {
	const crosswalks = artifacts.map((artifact) => ({
		id: artifact.id,
		from: artifact.from,
		to: artifact.to,
		method: artifact.method,
		quality: artifact.quality,
		...(artifact.relationshipPurpose === undefined
			? {}
			: { relationshipPurpose: artifact.relationshipPurpose }),
		weighting: artifact.weighting,
		recordCount: artifact.records.length,
		artifact: `crosswalks/${artifact.id}.json`,
		contentHash: artifact.contentHash,
	}));
	const content = JSON.stringify({ schemaVersion: 1, crosswalks });
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		crosswalks,
	};
};
