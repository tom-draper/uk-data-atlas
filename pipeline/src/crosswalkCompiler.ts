import { RawGeometryCache } from "../../shared/rawAreaGeometries";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileAreaOverlapCrosswalk } from "./areaOverlap";
import type { ReleaseCoverage } from "../../shared/relatedCodes";
import {
	compileBestFitCrosswalk,
	compileGeometricContainmentCrosswalk,
} from "./geometricContainment";
import { compilePopulationOverlapCrosswalk } from "./populationOverlap";
import { compileExtentContinuityCrosswalk } from "./extentContinuity";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../../shared/areaGeometry";
import {
	validateGeometryContainment,
	type GeometryContainmentValidation,
} from "../../shared/crosswalkGeometryValidation";
import type {
	AreaOverlapWeighting,
	BestFitCrosswalkAdapter,
	CoverageException,
	CrosswalkAdapter,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkSideAdapter,
	CrosswalkWeighting,
	GeometricContainmentCrosswalkAdapter,
	IndeterminatePairs,
	PopulationOverlapWeighting,
	PropertyCrosswalkAdapter,
	ExtentContinuityCrosswalkAdapter,
} from "../../shared/crosswalkAdapters";
import {
	validateEndpoint,
	type CrosswalkEndpointValidation,
} from "../../shared/crosswalkValidation";
import type { AreaLookup } from "../../shared/areaInventory";
import type { GeometryProvenance } from "@uk-data-atlas/geography/reprojection";
import { releaseKey } from "@uk-data-atlas/geography";
import { sha256 } from "../../shared/contentHash";

export type {
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "../../shared/crosswalkAdapters";
export type { CrosswalkEndpointValidation } from "../../shared/crosswalkValidation";

type FeatureCollection = {
	type?: unknown;
	features?: Array<{ properties?: unknown }>;
};

import type {
	CrosswalkArea,
	AreaOverlapSource,
	AreaOverlapTarget,
	AreaOverlapValidation,
	PropertyCrosswalkArtifact,
	CrosswalkChange,
	AreaOverlapCrosswalkArtifact,
	PopulationOverlapValidation,
	PopulationOverlapCrosswalkArtifact,
	GeometricContainmentValidation,
	GeometricContainmentCrosswalkArtifact,
	ExtentContinuityValidation,
	RecodedExtentComparison,
	ExtentContinuityCrosswalkArtifact,
	BestFitValidation,
	BestFitCrosswalkArtifact,
	CrosswalkArtifact,
} from "../../shared/crosswalkTypes";
export type {
	CrosswalkArea,
	AreaOverlapSource,
	AreaOverlapTarget,
	AreaOverlapValidation,
	PropertyCrosswalkArtifact,
	CrosswalkChange,
	AreaOverlapCrosswalkArtifact,
	PopulationOverlapValidation,
	PopulationOverlapCrosswalkArtifact,
	GeometricContainmentValidation,
	GeometricContainmentCrosswalkArtifact,
	ExtentContinuityValidation,
	RecodedExtentComparison,
	ExtentContinuityCrosswalkArtifact,
	BestFitValidation,
	BestFitCrosswalkArtifact,
	CrosswalkArtifact,
} from "../../shared/crosswalkTypes";

const CHANGE_INDICATORS: Record<string, CrosswalkChange> = {
	U: "unchanged",
	S: "split",
	M: "merged",
	X: "complex",
};

import type { CrosswalkInventory } from "../../shared/crosswalkInventory";
export type { CrosswalkInventory } from "../../shared/crosswalkInventory";

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

/**
 * A change indicator must agree with the lookup's own shape, or it would
 * mislabel a pair: unchanged is one-to-one both ways, a split source reaches
 * several targets, and a merged target is reached from several sources.
 */
const checkChanges = (
	crosswalkId: string,
	records: Map<string, { targets: Map<string, CrosswalkArea> }>,
	changes: Map<string, CrosswalkChange>,
) => {
	const sourcesByTarget = new Map<string, number>();
	for (const record of records.values())
		for (const target of record.targets.keys())
			sourcesByTarget.set(target, (sourcesByTarget.get(target) ?? 0) + 1);
	const disagreements = [...changes].flatMap(([pair, change]) => {
		const [source, target] = pair.split("|") as [string, string];
		const targets = records.get(source)?.targets.size ?? 0;
		const sources = sourcesByTarget.get(target) ?? 0;
		const agrees =
			change === "unchanged"
				? targets === 1 && sources === 1
				: change === "split"
					? targets > 1
					: change === "merged"
						? sources > 1
						: true;
		return agrees ? [] : [`${pair} is ${change}`];
	});
	if (disagreements.length > 0)
		throw new Error(
			`${crosswalkId}: change indicators disagree with the lookup: ${disagreements.slice(0, 5).join(", ")}`,
		);
};

const compilePropertyCrosswalk = (
	repositoryRoot: string,
	adapter: PropertyCrosswalkAdapter,
	areaLookup: AreaLookup | undefined,
	geometrySources: GeometrySourceLookup | undefined,
	geometryCache?: AreaGeometryCache,
): PropertyCrosswalkArtifact => {
	const inputPath = join(repositoryRoot, "data/source", adapter.input);
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
	const appliedTargetCorrections = new Set<string>();
	const endpointCodes = adapter.filterToEndpoints
		? {
				from: areaLookup?.get(
					releaseKey(
						adapter.from.geography,
						adapter.from.boundaryRelease,
					),
				),
				to: areaLookup?.get(
					releaseKey(
						adapter.to.geography,
						adapter.to.boundaryRelease,
					),
				),
			}
		: undefined;
	if (endpointCodes && (!endpointCodes.from || !endpointCodes.to))
		throw new Error(
			`${adapter.id}: filterToEndpoints needs compiled source and target areas.`,
		);
	// Keyed by source and target, since a pair's change is the publisher's.
	const changes = new Map<string, CrosswalkChange>();
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
		const publishedTarget = area(properties, adapter.to, adapter.id, index);
		if (
			endpointCodes &&
			(!endpointCodes.from!.has(sourceArea.code) ||
				!endpointCodes.to!.has(publishedTarget.code))
		)
			continue;
		const correction = adapter.targetCodeCorrections?.[sourceArea.code];
		let targetArea = publishedTarget;
		if (correction) {
			if (publishedTarget.code !== correction.publishedTargetCode)
				throw new Error(
					`${adapter.id}: ${sourceArea.code} publishes target ${publishedTarget.code}, but its correction expects ${correction.publishedTargetCode}.`,
				);
			const correctedTarget = areaLookup
				?.get(
					releaseKey(
						adapter.to.geography,
						adapter.to.boundaryRelease,
					),
				)
				?.get(correction.correctedTargetCode);
			if (!correctedTarget)
				throw new Error(
					`${adapter.id}: corrected target ${correction.correctedTargetCode} for ${sourceArea.code} does not exist in ${adapter.to.geography}/${adapter.to.boundaryRelease}.`,
				);
			targetArea = {
				code: correctedTarget.code,
				labels: [
					correctedTarget.name,
					...(correctedTarget.aliases ?? []),
				]
					.filter(Boolean)
					.sort(),
			};
			appliedTargetCorrections.add(sourceArea.code);
		}
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
		if (adapter.changeProperty) {
			const indicator = properties[adapter.changeProperty];
			const change = CHANGE_INDICATORS[String(indicator)];
			if (!change)
				throw new Error(
					`${adapter.id}: feature ${index} has change indicator ${String(indicator)}, not U, S, M or X`,
				);
			const pair = `${sourceArea.code}|${targetArea.code}`;
			const previous = changes.get(pair);
			if (previous && previous !== change)
				throw new Error(
					`${adapter.id}: ${pair} is both ${previous} and ${change}`,
				);
			changes.set(pair, change);
		}
	}
	const unappliedCorrections = Object.keys(
		adapter.targetCodeCorrections ?? {},
	).filter((code) => !appliedTargetCorrections.has(code));
	if (unappliedCorrections.length > 0)
		throw new Error(
			`${adapter.id}: target corrections do not name source codes in the input: ${unappliedCorrections.join(", ")}.`,
		);
	if (adapter.changeProperty) checkChanges(adapter.id, records, changes);
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
			targets: [...record.targets.values()]
				.map((target) => {
					const change = changes.get(
						`${record.source.code}|${target.code}`,
					);
					return change ? { ...target, change } : target;
				})
				.sort((left, right) => left.code.localeCompare(right.code)),
		}))
		.sort((left, right) =>
			left.source.code.localeCompare(right.source.code),
		);
	const geometryContainment =
		adapter.method === "clean-containment"
			? validateGeometryContainment(
					repositoryRoot,
					geometrySources,
					{
						crosswalkId: adapter.id,
						from: adapter.from,
						to: adapter.to,
						records: compiledRecords,
					},
					geometryCache,
				)
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
		provenance: {
			input: adapter.input,
			inputHash: sha256(input),
			...(adapter.targetCodeCorrections
				? {
						corrections: Object.entries(
							adapter.targetCodeCorrections,
						).map(([sourceCode, correction]) => ({
							sourceCode,
							...correction,
						})),
					}
				: {}),
		},
		validation: {
			sourceNameConflicts,
			endpoints,
			...(geometryContainment ? { geometryContainment } : {}),
			...(adapter.changeProperty
				? {
						changes: Object.fromEntries(
							Object.values(CHANGE_INDICATORS).map((change) => [
								change,
								[...changes.values()].filter(
									(value) => value === change,
								).length,
							]),
						) as Record<CrosswalkChange, number>,
					}
				: {}),
		},
		records: compiledRecords,
	};
	return {
		...artifactWithoutHash,
		contentHash: sha256(JSON.stringify(artifactWithoutHash)),
	};
};

/** One compiler owns the geometry caches for its compilation run. */
export const createCrosswalkCompiler = (
	repositoryRoot: string,
	areaLookup?: AreaLookup,
	geometrySources?: GeometrySourceLookup,
) => {
	const rawGeometryCache = new RawGeometryCache();
	const geometryCache = geometrySources
		? new AreaGeometryCache(repositoryRoot, geometrySources, 2)
		: undefined;
	return (
		adapter: CrosswalkAdapter,
		pairs?: CrosswalkArtifact,
	): CrosswalkArtifact => {
		if (
			adapter.method === "official-lookup" ||
			adapter.method === "clean-containment"
		) {
			return compilePropertyCrosswalk(
				repositoryRoot,
				adapter,
				areaLookup,
				geometrySources,
				geometryCache,
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
				rawGeometryCache.read,
			);
		}
		if (adapter.method === "best-fit") {
			return compileBestFitCrosswalk(
				repositoryRoot,
				adapter,
				geometrySources,
				areaLookup,
				rawGeometryCache.read,
			);
		}
		if (adapter.method === "extent-continuity") {
			return compileExtentContinuityCrosswalk(
				repositoryRoot,
				adapter,
				geometrySources,
				areaLookup,
				rawGeometryCache.read,
			);
		}
		if (adapter.method === "population-overlap") {
			return compilePopulationOverlapCrosswalk(
				repositoryRoot,
				adapter,
				geometrySources,
				areaLookup,
				pairs,
				rawGeometryCache.read,
			);
		}
		if (adapter.method === "area-overlap") {
			return compileAreaOverlapCrosswalk(
				repositoryRoot,
				adapter,
				geometrySources,
				areaLookup,
				rawGeometryCache.read,
			);
		}
		throw new Error(`${adapter.id}: no compiler for ${adapter.method}.`);
	};
};

/** Compile in adapter order, retaining only pairs needed by later populations. */
export function* compileCrosswalks(
	repositoryRoot: string,
	adapters: CrosswalkAdapter[],
	areaLookup?: AreaLookup,
	geometrySources?: GeometrySourceLookup,
	prior: ReadonlyMap<string, CrosswalkArtifact> = new Map(),
): Generator<CrosswalkArtifact> {
	const compile = createCrosswalkCompiler(
		repositoryRoot,
		areaLookup,
		geometrySources,
	);
	const uses = new Map<string, number>();
	for (const adapter of adapters)
		if (adapter.method === "population-overlap")
			uses.set(adapter.pairs, (uses.get(adapter.pairs) ?? 0) + 1);
	const pairs = new Map([...prior].filter(([id]) => uses.has(id)));
	for (const adapter of adapters) {
		const artifact = compile(
			adapter,
			adapter.method === "population-overlap"
				? pairs.get(adapter.pairs)
				: undefined,
		);
		if (adapter.method === "population-overlap") {
			const remaining = uses.get(adapter.pairs)! - 1;
			uses.set(adapter.pairs, remaining);
			if (remaining === 0) pairs.delete(adapter.pairs);
		}
		if ((uses.get(artifact.id) ?? 0) > 0) pairs.set(artifact.id, artifact);
		yield artifact;
	}
}

type CrosswalkInventoryEntry = CrosswalkInventory["crosswalks"][number];

/**
 * What the inventory keeps of an artifact. A build holds these rather than
 * the artifacts, whose records run to hundreds of megabytes between them.
 */
export const crosswalkInventoryEntry = (
	artifact: CrosswalkArtifact,
): CrosswalkInventoryEntry => ({
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
});

export const createCrosswalkInventory = (
	artifacts: CrosswalkArtifact[],
): CrosswalkInventory =>
	crosswalkInventoryFromEntries(artifacts.map(crosswalkInventoryEntry));

export const crosswalkInventoryFromEntries = (
	crosswalks: CrosswalkInventoryEntry[],
	releaseCoverage?: CrosswalkInventory["releaseCoverage"],
): CrosswalkInventory => {
	const content = JSON.stringify({ schemaVersion: 1, crosswalks });
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		crosswalks,
		...(releaseCoverage === undefined ? {} : { releaseCoverage }),
	};
};
