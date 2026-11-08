import { compilePropertyCrosswalk } from "./propertyCrosswalk.ts";
export {
	crosswalkInventoryEntry,
	createCrosswalkInventory,
	crosswalkInventoryFromEntries,
} from "./crosswalkInventory.ts";
export type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import {
	RawGeometryCache,
	type AreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import { compileAreaOverlapCrosswalk } from "../geographies/areaOverlap.ts";
import {
	compileBestFitCrosswalk,
	compileGeometricContainmentCrosswalk,
} from "./geometricContainment.ts";
import { compilePopulationOverlapCrosswalk } from "./populationOverlap.ts";
import { compilePostcodeOverlapCrosswalk } from "./postcodeOverlap.ts";
import { compileExtentContinuityCrosswalk } from "./extentContinuity.ts";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "@uk-data-atlas/atlas-runtime/geometry";
import type {
	CrosswalkAdapter,
	CrosswalkArtifact,
} from "@uk-data-atlas/atlas-runtime/relationships";

export type {
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "@uk-data-atlas/atlas-runtime/relationships";
export type { CrosswalkEndpointValidation } from "@uk-data-atlas/atlas-runtime/relationships";

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
	PostcodeOverlapValidation,
	PostcodeOverlapCrosswalkArtifact,
	GeometricContainmentValidation,
	GeometricContainmentCrosswalkArtifact,
	ExtentContinuityValidation,
	RecodedExtentComparison,
	ExtentContinuityCrosswalkArtifact,
	BestFitValidation,
	BestFitCrosswalkArtifact,
	CrosswalkArtifact,
} from "@uk-data-atlas/atlas-runtime/relationships";

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
		if (adapter.method === "postcode-overlap") {
			return compilePostcodeOverlapCrosswalk(
				repositoryRoot,
				adapter,
				geometrySources,
				areaLookup,
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
