import type { AreaInventory, AreaLookup, AreaRecord } from "./areaInventory";
import { explainAreaAbsence, type AreaAbsence } from "./areaAbsence";
import {
	summariseBatch,
	validateBatch,
	type ValidatedValue,
} from "./batchValidation";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	AreaGeometryCache,
	AreaGeometryCacheStats,
	GeoJsonGeometry,
	IntersectingArea,
} from "./areaGeometry";
import { distanceToBoundaryM } from "./areaDistance";
import type { Neighbour } from "./areaNeighbours";
import type { GeometryBounds, PointContainment } from "./areaContainment";
import {
	createAreaSearchIndex,
	searchAreas,
	type AreaSearchIndex,
} from "./areaSearch";
import {
	createAreaRelationshipIndex,
	type AreaRelation,
	type AreaRelationship,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type {
	CrosswalkArtifact,
	CrosswalkArea,
	CrosswalkInventory,
} from "./crosswalkInventory";
import { crosswalksTo } from "./locationMembership";
import {
	type LocationProjectionStore,
	type LocationProjection,
} from "./locationProjections";
import type {
	NamedLocation,
	NamedLocationInventory,
	NamedLocationLookup,
} from "./namedLocations";
import type {
	RelationshipPath,
	RelationshipPurpose,
} from "./relationshipPaths";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type { GeometryProvenance } from "./reprojection";
import {
	ConversionCapabilities,
	type GeographyReach,
	type RelationshipOperation,
	type ResolvedConversionPlan,
	type ResolvedRelationshipCapability,
} from "./resolver/conversionCapability";
import {
	compareBoundaryReleases,
	type BoundaryReleaseComparison,
} from "./resolver/releaseComparison";
import {
	CrosswalkTranslator,
	type AreaIdentity,
	type CrosswalkLookup,
	type GeographyEndpoint,
	type ResolvedAreaTranslation,
} from "./resolver/translation";
import {
	derivedReleaseSources,
	selectReleaseForDate,
	type ReleaseSelection,
} from "./releaseForDate";

export {
	RELATIONSHIP_OPERATIONS,
	type GeographyReach,
	type RelationshipOperation,
	type RelationshipPathStepCoverage,
	type RelationshipPrerequisite,
	type ResolvedConversionPlan,
	type ResolvedRelationshipCapability,
	type ResolvedRelationshipPath,
} from "./resolver/conversionCapability";
export type {
	BoundaryExtentChange,
	BoundaryReleaseComparison,
	PublishedRelationshipMapping,
} from "./resolver/releaseComparison";
export type {
	AreaIdentity,
	CrosswalkLookup,
	ResolvedAreaTranslation,
} from "./resolver/translation";

export type ResolvedContainingArea = AreaRecord & {
	id: string;
	containment: PointContainment;
	/** Metres from the point to the area's nearest edge. */
	distanceToBoundaryM: number;
	geometrySource: GeometryProvenance;
};

export type ResolvedNearbyArea = AreaRecord & {
	id: string;
	/** Metres to the area, zero when the point is on or inside it. */
	distanceM: number;
	geometrySource: GeometryProvenance;
};

export type ResolvedNearbyAreas = {
	/** Every area within the distance, before any limit. */
	matched: number;
	nearest: ResolvedNearbyArea[];
};

export type ResolvedAreaGeometry = AreaRecord & {
	id: string;
	geometry: GeoJsonGeometry;
	geometrySource: GeometryProvenance;
};

export type ResolvedGeometry = {
	geometry: GeoJsonGeometry;
	geometrySource: GeometryProvenance;
};

export type ResolvedIntersectingArea = AreaRecord & {
	id: string;
	relation: IntersectingArea["relation"];
	boundingBox: GeometryBounds;
	geometry: GeoJsonGeometry;
	geometrySource: GeometryProvenance;
};

export type ResolvedIntersectingAreas = {
	/** All raw-geometry matches, including any not present in the inventory. */
	matched: number;
	matches: ResolvedIntersectingArea[];
};

export type ResolvedAreaNeighbour = Neighbour & {
	id: string;
	area?: AreaRecord;
};

export type ResolvedSameCodeArea = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
	/** The identifier recurs; no unchanged-boundary claim is implied. */
	status: "same-code-continuity";
};

/**
 * A published edge as a walk of the graph found it: `from` is the area the
 * walk stood on, `counterpart` the area it reached, and `depth` the number of
 * edges from the area that was asked about.
 */
export type TraversedRelationship = AreaRelationship & {
	from: string;
	depth: number;
};

export type ResolvedAreaHistory = {
	area: AreaRecord;
	relationships: AreaRelationship[];
	/** Every declared historical edge reachable, each reported once. */
	lineage: TraversedRelationship[];
	sameCodeReleases: ResolvedSameCodeArea[];
};

export type ResolvedAreaRelationshipSummary = {
	relationships: AreaRelationship[];
	byRelation: Partial<Record<AreaRelation, number>>;
	parentCount: number;
	childCount: number;
	crosswalks: AreaRelationship["crosswalk"][];
};

export type ResolvedAreaNeighbours = {
	geometry: GeoJsonGeometry;
	neighbours: ResolvedAreaNeighbour[];
};

export type ResolvedRelationshipCoverage = {
	areaCount: number;
	relatedAreaCount: number;
	relationshipCount: number;
	byRelation: Partial<Record<AreaRelation, number>>;
	crosswalkIds: string[];
	uncoveredAreas: Array<AreaRecord & { id: string }>;
};

export type GeographyHealth = {
	geography: string;
	boundaryRelease: string;
	status: "available" | "partial" | "unsupported" | "not-built";
	areaCount: number;
	relatedAreaCount: number;
	gapCount: number;
	countries: string[];
	reach: GeographyReach;
};

export type RelationshipRepair = {
	candidate: RelationshipCandidateInventory["candidates"][number];
	action: "publish-crosswalk" | "review-candidate" | "compile-target-release";
};

export type GeographyResolverInputs = {
	boundaryRegistry?: BoundaryRegistry;
	areaInventory?: AreaInventory;
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	areaGeometryCache?: AreaGeometryCache;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjectionStore;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
};

const areaId = ({ geography, boundaryRelease, code }: AreaIdentity) =>
	[geography, boundaryRelease, code].join("/");

/**
 * Read-only geography intelligence over one immutable Atlas release.
 *
 * The compiler produces the source artifacts; this facade owns the derived
 * runtime indexes so routes do not need to know how identities, crosswalks and
 * named places are stored. It intentionally exposes facts and relationships,
 * not measure conversion or HTTP concerns.
 */
export class GeographyResolver {
	private readonly areaSearchIndex?: AreaSearchIndex;
	private readonly areaRelationshipIndex?: AreaRelationshipIndex;
	private readonly crosswalksBySource = new Map<
		string,
		CrosswalkInventory["crosswalks"]
	>();
	private readonly sameCodeAreas = new Map<string, ResolvedSameCodeArea[]>();
	private readonly locationsByMemberArea = new Map<string, NamedLocation[]>();
	private readonly boundaryReleases = new Map<
		string,
		BoundaryRegistry["releases"][number]
	>();
	private readonly derivedReleaseSources: Map<string, string>;
	private readonly translator: CrosswalkTranslator;
	private readonly capabilities: ConversionCapabilities;

	constructor(private readonly inputs: GeographyResolverInputs) {
		this.translator = new CrosswalkTranslator(inputs);
		this.capabilities = new ConversionCapabilities(inputs, this.translator);
		this.derivedReleaseSources = derivedReleaseSources(inputs.areaInventory);
		for (const release of inputs.boundaryRegistry?.releases ?? []) {
			this.boundaryReleases.set(`${release.geography}/${release.id}`, release);
		}
		if (inputs.areaLookup) {
			this.areaSearchIndex = createAreaSearchIndex(inputs.areaLookup);
			for (const [releaseIdentity, areas] of inputs.areaLookup) {
				const [geography, boundaryRelease] = releaseIdentity.split("/", 2);
				if (!geography || !boundaryRelease) continue;
				for (const [code, area] of areas) {
					const key = `${geography}/${code}`;
					const candidates = this.sameCodeAreas.get(key) ?? [];
					candidates.push({
						id: areaId({ geography, boundaryRelease, code }),
						geography,
						boundaryRelease,
						...area,
						status: "same-code-continuity",
					});
					this.sameCodeAreas.set(key, candidates);
				}
			}
			for (const candidates of this.sameCodeAreas.values()) {
				candidates.sort((left, right) =>
					left.boundaryRelease.localeCompare(right.boundaryRelease),
				);
			}
		}
		if (inputs.crosswalkLookup) {
			this.areaRelationshipIndex = createAreaRelationshipIndex(
				inputs.crosswalkLookup.values(),
			);
		}
		for (const location of inputs.namedLocationInventory?.locations ?? []) {
			for (const code of location.memberCodes) {
				const key = `${location.memberGeography}/${code}`;
				const locations = this.locationsByMemberArea.get(key) ?? [];
				locations.push(location);
				this.locationsByMemberArea.set(key, locations);
			}
		}
		for (const locations of this.locationsByMemberArea.values()) {
			locations.sort((left, right) => left.id.localeCompare(right.id));
		}
		for (const crosswalk of inputs.crosswalkInventory?.crosswalks ?? []) {
			const key = [
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
				crosswalk.to.geography,
			].join("/");
			const candidates = this.crosswalksBySource.get(key) ?? [];
			candidates.push(crosswalk);
			this.crosswalksBySource.set(key, candidates);
		}
		for (const candidates of this.crosswalksBySource.values()) {
			candidates.sort((left, right) => left.id.localeCompare(right.id));
		}
	}

	area(identity: AreaIdentity): AreaRecord | undefined {
		return this.inputs.areaLookup
			?.get(`${identity.geography}/${identity.boundaryRelease}`)
			?.get(identity.code);
	}

	hasAreaRelease(geography: string, boundaryRelease: string): boolean {
		return (
			this.inputs.areaLookup?.has(`${geography}/${boundaryRelease}`) ??
			false
		);
	}

	/** One published boundary release's metadata, indexed by its identity. */
	boundaryRelease(geography: string, id: string) {
		return this.boundaryReleases.get(`${geography}/${id}`);
	}

	/**
	 * Explain an unresolved area identity using the resolver's compiled
	 * boundary and identity inputs. Undefined means this resolver was built
	 * without a boundary registry, so a caller can report its own deployment
	 * limitation rather than inventing an absence.
	 */
	explainAreaAbsence(
		geography: string,
		boundaryRelease: string,
		code: string,
	): AreaAbsence | undefined {
		return this.inputs.boundaryRegistry
			? explainAreaAbsence(
					this.inputs.boundaryRegistry,
					this.inputs.areaInventory,
					this.inputs.areaLookup,
					geography,
					boundaryRelease,
					code,
				)
			: undefined;
	}

	/** Validate candidate codes and names against one exact compiled release. */
	validateAreas(
		geography: string,
		boundaryRelease: string,
		values: string[],
	): { values: ValidatedValue[]; summary: ReturnType<typeof summariseBatch> } | undefined {
		if (!this.inputs.areaLookup?.has(`${geography}/${boundaryRelease}`))
			return undefined;
		const validated = validateBatch(
			this.inputs.areaLookup,
			geography,
			boundaryRelease,
			values,
		);
		return { values: validated, summary: summariseBatch(validated) };
	}

	/**
	 * Select the best published boundary snapshot for a geography, date and
	 * optional country. This is one resolver policy, shared by area resolution
	 * and coordinate lookup; routes only validate their own request shape.
	 */
	selectReleaseForDate(
		geography: string,
		month: string,
		country?: string,
	): ReleaseSelection | undefined {
		return this.inputs.boundaryRegistry
			? selectReleaseForDate(
					this.inputs.boundaryRegistry,
					geography,
					month,
					country,
					this.derivedReleaseSources,
				)
			: undefined;
	}

	hasAreaGeometryCache(): boolean {
		return this.inputs.areaGeometryCache !== undefined;
	}

	/** How the geometry cache has behaved, for operational metrics. */
	geometryCacheStats(): AreaGeometryCacheStats | undefined {
		return this.inputs.areaGeometryCache?.stats();
	}

	hasAreaRelationships(): boolean {
		return this.inputs.crosswalkLookup !== undefined;
	}

	/** An area's WGS84 geometry and source provenance, when the source holds it. */
	geometryFor(identity: AreaIdentity): ResolvedGeometry | undefined {
		const cache = this.inputs.areaGeometryCache;
		if (!cache) return undefined;
		const geometry = cache.get(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		return geometry
			? {
					geometry,
					geometrySource: cache.provenance(
						identity.geography,
						identity.boundaryRelease,
						identity.code,
					),
				}
			: undefined;
	}

	/** A published area's WGS84 geometry and source provenance. */
	areaGeometry(identity: AreaIdentity): ResolvedAreaGeometry | undefined {
		const area = this.area(identity);
		const resolved = this.geometryFor(identity);
		return area && resolved
			? { id: areaId(identity), ...area, ...resolved }
			: undefined;
	}

	/** Areas in one release whose boundaries meet a published area. */
	areaNeighbours(identity: AreaIdentity): ResolvedAreaNeighbours | undefined {
		const cache = this.inputs.areaGeometryCache;
		if (!cache) return undefined;
		const neighbours = cache.findNeighbours(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		const geometry = cache.get(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		if (!neighbours || !geometry) return undefined;
		return {
			geometry,
			neighbours: neighbours.map((neighbour) => ({
				...neighbour,
				id: areaId({
					geography: identity.geography,
					boundaryRelease: identity.boundaryRelease,
					code: neighbour.code,
				}),
				area: this.area({
					geography: identity.geography,
					boundaryRelease: identity.boundaryRelease,
					code: neighbour.code,
				}),
			})),
		};
	}

	/** Areas in one release that contain a WGS84 coordinate. */
	containingAreas(
		geography: string,
		boundaryRelease: string,
		point: [number, number],
	): ResolvedContainingArea[] | undefined {
		const cache = this.inputs.areaGeometryCache;
		if (!cache) return undefined;
		return cache
			.findContaining(geography, boundaryRelease, point)
			.flatMap(({ code, containment }) => {
				const area = this.area({ geography, boundaryRelease, code });
				const geometry = cache.get(geography, boundaryRelease, code);
				return area && geometry
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								containment,
								distanceToBoundaryM: distanceToBoundaryM(
									point,
									geometry,
								),
								geometrySource: cache.provenance(
									geography,
									boundaryRelease,
									code,
								),
							},
						]
					: [];
			});
	}

	/** Published areas of one release nearest a WGS84 coordinate, nearest first. */
	nearestAreas(
		geography: string,
		boundaryRelease: string,
		point: [number, number],
		{ withinM, limit }: { withinM: number; limit: number },
	): ResolvedNearbyAreas | undefined {
		const cache = this.inputs.areaGeometryCache;
		if (!cache) return undefined;
		const found = cache
			.findNearest(geography, boundaryRelease, point, withinM)
			.flatMap(({ code, distanceM }) => {
				const area = this.area({ geography, boundaryRelease, code });
				return area ? [{ code, area, distanceM }] : [];
			});
		return {
			matched: found.length,
			nearest: found.slice(0, limit).map(({ code, area, distanceM }) => ({
				id: areaId({ geography, boundaryRelease, code }),
				...area,
				distanceM,
				geometrySource: cache.provenance(
					geography,
					boundaryRelease,
					code,
				),
			})),
		};
	}

	/** How a release's geometry reached WGS84, without any one area's corrections. */
	releaseGeometrySource(
		geography: string,
		boundaryRelease: string,
	): GeometryProvenance | undefined {
		return this.inputs.areaGeometryCache?.provenance(
			geography,
			boundaryRelease,
		);
	}

	/** Published areas meeting a WGS84 box, with geometry for optional rendering. */
	intersectingAreas(
		geography: string,
		boundaryRelease: string,
		box: GeometryBounds,
	): ResolvedIntersectingAreas | undefined {
		const cache = this.inputs.areaGeometryCache;
		if (!cache) return undefined;
		const found = cache.findIntersecting(geography, boundaryRelease, box);
		return {
			matched: found.length,
			matches: found.flatMap(({ code, relation, bounds }) => {
				const area = this.area({ geography, boundaryRelease, code });
				const geometry = cache.get(geography, boundaryRelease, code);
				return area && geometry
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								relation,
								boundingBox: bounds,
								geometry,
								geometrySource: cache.provenance(
									geography,
									boundaryRelease,
									code,
								),
							},
						]
					: [];
			}),
		};
	}

	searchAreas(query: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query?: string;
	}) {
		return this.areaSearchIndex
			? searchAreas(this.areaSearchIndex, query)
			: [];
	}

	relationships(identity: AreaIdentity): AreaRelationship[] {
		return this.areaRelationshipIndex?.get(areaId(identity)) ?? [];
	}

	/**
	 * Breadth-first walk of the published relationship graph, following only the
	 * relations asked for. Each area is reached once, at its shortest depth, and
	 * each edge is reported once: a crosswalk that publishes a link from both
	 * ends, as predecessor and successor edges are, states one fact, not two.
	 */
	private traverse(
		identity: AreaIdentity,
		follow: (relation: AreaRelation) => boolean,
		maximumDepth: number,
	): TraversedRelationship[] {
		const origin = areaId(identity);
		const visited = new Set([origin]);
		const reported = new Set<string>();
		const queue = [{ id: origin, depth: 0 }];
		const edges: TraversedRelationship[] = [];
		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current.depth >= maximumDepth) continue;
			for (const relationship of this.areaRelationshipIndex?.get(
				current.id,
			) ?? []) {
				if (!follow(relationship.relation)) continue;
				const ends = [current.id, relationship.counterpart.id].sort();
				const edge = `${relationship.crosswalk.id}|${ends[0]}|${ends[1]}`;
				if (!reported.has(edge)) {
					reported.add(edge);
					edges.push({
						...relationship,
						from: current.id,
						depth: current.depth + 1,
					});
				}
				if (!visited.has(relationship.counterpart.id)) {
					visited.add(relationship.counterpart.id);
					queue.push({
						id: relationship.counterpart.id,
						depth: current.depth + 1,
					});
				}
			}
		}
		return edges;
	}

	/** Follow only declared containment edges, never inferred geography hierarchy. */
	ancestorLineage(identity: AreaIdentity, maximumDepth: number) {
		return this.traverse(
			identity,
			(relation) => relation === "within",
			maximumDepth,
		);
	}

	/** Follow only declared containment edges down the published hierarchy. */
	descendantLineage(identity: AreaIdentity, maximumDepth: number) {
		return this.traverse(
			identity,
			(relation) => relation === "contains",
			maximumDepth,
		);
	}

	/** One consistent summary of an area's published relationship evidence. */
	areaRelationshipSummary(
		identity: AreaIdentity,
	): ResolvedAreaRelationshipSummary {
		const relationships = this.relationships(identity);
		const byRelation = relationships.reduce<
			Partial<Record<AreaRelation, number>>
		>((counts, { relation }) => {
			counts[relation] = (counts[relation] ?? 0) + 1;
			return counts;
		}, {});
		return {
			relationships,
			byRelation,
			parentCount: byRelation.within ?? 0,
			childCount: byRelation.contains ?? 0,
			crosswalks: [
				...new Map(
					relationships.map((relationship) => [
						relationship.crosswalk.id,
						relationship.crosswalk,
					]),
				).values(),
			],
		};
	}

	/** Published history graph plus explicitly qualified recurring identifiers. */
	areaHistory(identity: AreaIdentity, maximumDepth = 8): ResolvedAreaHistory | undefined {
		const area = this.area(identity);
		if (!area) return undefined;
		const historical = (area: string) =>
			(this.areaRelationshipIndex?.get(area) ?? []).filter(
				({ relation }) => relation === "successor" || relation === "predecessor",
			);
		const origin = areaId(identity);
		const lineage = this.traverse(
			identity,
			(relation) => relation === "successor" || relation === "predecessor",
			maximumDepth,
		);
		return {
			area,
			relationships: historical(origin),
			lineage,
			sameCodeReleases: (this.sameCodeAreas.get(
				`${identity.geography}/${identity.code}`,
			) ?? []).filter(
				({ boundaryRelease }) => boundaryRelease !== identity.boundaryRelease,
			),
		};
	}

	namedLocation(id: string): NamedLocation | undefined {
		return this.inputs.namedLocationLookup?.get(id);
	}

	hasNamedLocationInventory(): boolean {
		return this.inputs.namedLocationInventory !== undefined;
	}

	/** Curated locations that directly include this area's published code. */
	namedLocationsForArea(identity: AreaIdentity): NamedLocation[] {
		return this.locationsByMemberArea.get(
			`${identity.geography}/${identity.code}`,
		) ?? [];
	}

	crosswalk(id: string): CrosswalkArtifact | undefined {
		return this.inputs.crosswalkLookup?.get(id);
	}

	locationProjection(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	): LocationProjection | undefined {
		return this.inputs.locationProjectionStore?.get(
			locationId,
			geography,
			boundaryRelease,
			crosswalkId,
		);
	}

	hasLocationProjectionStore(): boolean {
		return this.inputs.locationProjectionStore !== undefined;
	}

	/** Materialised routes into the declared member geography of a location. */
	locationMemberProjectionShards(memberGeography: string) {
		const store = this.inputs.locationProjectionStore;
		const summaries = new Map(
			(this.inputs.crosswalkInventory?.crosswalks ?? []).map((summary) => [
				summary.id,
				summary,
			]),
		);
		return (store?.memberProjectionShards() ?? []).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
			return summary?.to.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}

	/** Materialised routes out of the declared member geography of a location. */
	locationParentProjectionShards(memberGeography: string) {
		const store = this.inputs.locationProjectionStore;
		const summaries = new Map(
			(this.inputs.crosswalkInventory?.crosswalks ?? []).map((summary) => [
				summary.id,
				summary,
			]),
		);
		return (store?.parentProjectionShards() ?? []).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
			return summary?.from.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}

	/** Crosswalks with materialised location parents in a geography release. */
	locationParentCrosswalks(geography: string, boundaryRelease: string) {
		return (
			this.inputs.locationProjectionStore?.parentCrosswalks(
				geography,
				boundaryRelease,
			) ?? []
		);
	}

	locationParents(locationId: string, crosswalkId: string) {
		return this.inputs.locationProjectionStore?.parents(
			locationId,
			crosswalkId,
		);
	}

	relationshipPaths(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	) {
		return this.translator.publishedPaths(from, to, purpose);
	}

	/** A published relationship path by id. */
	relationshipPath(id: string): RelationshipPath | undefined {
		return this.translator.path(id);
	}

	/** A path's steps with their cached crosswalk indexes, ready to convert values. */
	indexedPathSteps(path: RelationshipPath) {
		return this.translator.indexedSteps(path);
	}

	/**
	 * Translate one exact area through every published path that has a result for
	 * it. Direct paths retain the long-standing crosswalk response shape; a
	 * composed path carries its full route so callers can inspect every step.
	 */
	translateArea(
		source: AreaIdentity,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): ResolvedAreaTranslation[] {
		return this.translator.translateArea(source, to, purpose);
	}

	/**
	 * Explains whether an exact conversion is usable, including the source
	 * coverage of each declared path and every artifact still needed to make
	 * that claim. This keeps route handlers out of crosswalk internals.
	 */
	relationshipCapability(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): ResolvedRelationshipCapability {
		return this.capabilities.relationshipCapability(from, to, purpose);
	}

	/** The best published path for an exact conversion, with its alternatives. */
	conversionPlan(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
		operation?: RelationshipOperation,
	): ResolvedConversionPlan {
		return this.capabilities.conversionPlan(from, to, purpose, operation);
	}

	/** Every declared conversion starting at one exact release. */
	relationshipCapabilitiesFrom(from: GeographyEndpoint) {
		return this.capabilities.relationshipCapabilitiesFrom(from);
	}

	/** Release-level relationship coverage for finding holes in the hierarchy. */
	relationshipCoverage(
		geography: string,
		boundaryRelease: string,
		relation?: AreaRelation,
		limit = 25,
	): ResolvedRelationshipCoverage | undefined {
		const areas = this.inputs.areaLookup?.get(
			`${geography}/${boundaryRelease}`,
		);
		if (!areas || !this.areaRelationshipIndex) return undefined;
		const byRelation: Partial<Record<AreaRelation, number>> = {};
		const crosswalkIds = new Set<string>();
		let relatedAreaCount = 0;
		let relationshipCount = 0;
		const uncoveredAreas: ResolvedRelationshipCoverage["uncoveredAreas"] = [];
		for (const [code, area] of areas) {
			const relationships = (this.areaRelationshipIndex.get(
				areaId({ geography, boundaryRelease, code }),
			) ?? []).filter((candidate) => !relation || candidate.relation === relation);
			if (relationships.length > 0) {
				relatedAreaCount += 1;
				relationshipCount += relationships.length;
				for (const candidate of relationships) {
					byRelation[candidate.relation] =
						(byRelation[candidate.relation] ?? 0) + 1;
					crosswalkIds.add(candidate.crosswalk.id);
				}
			} else if (uncoveredAreas.length < limit) {
				uncoveredAreas.push({
					id: areaId({ geography, boundaryRelease, code }),
					...area,
				});
			}
		}
		return {
			areaCount: areas.size,
			relatedAreaCount,
			relationshipCount,
			byRelation,
			crosswalkIds: [...crosswalkIds].sort(),
			uncoveredAreas,
		};
	}

	/**
	 * Compare two compiled releases of one geography without promoting code-set
	 * differences into geographical change claims.
	 */
	compareBoundaryReleases(
		geography: string,
		fromRelease: string,
		toRelease: string,
		limit = 25,
	): BoundaryReleaseComparison | undefined {
		return compareBoundaryReleases(
			this.inputs,
			geography,
			fromRelease,
			toRelease,
			limit,
		);
	}

	/** A release-by-release relationship health report for repair prioritisation. */
	geographyHealth(): GeographyHealth[] {
		if (!this.inputs.areaLookup) return [];
		const reach = this.capabilities.conversionReach();
		return [...this.inputs.areaLookup.keys()]
			.map((identity) => {
				const [geography, boundaryRelease] = identity.split("/", 2) as [string, string];
				const coverage = this.relationshipCoverage(geography, boundaryRelease, undefined, 1);
				const areaCount = this.inputs.areaLookup?.get(identity)?.size ?? 0;
				const countries = this.boundaryRelease(geography, boundaryRelease)?.coverage.countries ?? [];
				const found = reach.get(identity) ?? { status: "isolated" as const, reaches: [], reachedFrom: [], vintagePathCount: 0 };
				if (!coverage) return { geography, boundaryRelease, status: "not-built" as const, areaCount, relatedAreaCount: 0, gapCount: areaCount, countries, reach: found };
				return {
					geography, boundaryRelease,
					status: coverage.relatedAreaCount === coverage.areaCount ? "available" as const : coverage.relatedAreaCount > 0 ? "partial" as const : "unsupported" as const,
					areaCount: coverage.areaCount,
					relatedAreaCount: coverage.relatedAreaCount,
					gapCount: coverage.areaCount - coverage.relatedAreaCount,
					countries,
					reach: found,
				};
			})
			.sort((left, right) => `${left.geography}/${left.boundaryRelease}`.localeCompare(`${right.geography}/${right.boundaryRelease}`));
	}

	/** A deterministic, review-only queue for repairing published relationship gaps. */
	relationshipRepairs(): RelationshipRepair[] {
		const actionFor = (candidate: RelationshipRepair["candidate"]): RelationshipRepair["action"] =>
			candidate.status === "eligible"
				? "publish-crosswalk"
				: candidate.status === "needs-review"
					? "review-candidate"
					: "compile-target-release";
		const order = { "publish-crosswalk": 0, "review-candidate": 1, "compile-target-release": 2 } as const;
		return (this.inputs.relationshipCandidateInventory?.candidates ?? [])
			.filter((candidate) => !candidate.publishedCrosswalkId)
			.map((candidate) => ({ candidate, action: actionFor(candidate) }))
			.sort((left, right) => order[left.action] - order[right.action] || left.candidate.id.localeCompare(right.candidate.id));
	}

	/** Crosswalks from a target geography/release into a location's LAD members. */
	crosswalksToLocationMembers(
		geography: string,
		boundaryRelease: string,
		memberGeography: string,
	) {
		const direct = this.crosswalksBySource.get(
			[geography, boundaryRelease, memberGeography].join("/"),
		);
		return (
			direct ??
			(this.inputs.crosswalkInventory
				? crosswalksTo(
						this.inputs.crosswalkInventory,
						geography,
						boundaryRelease,
						memberGeography,
					)
				: [])
		);
	}
}

export const createGeographyResolver = (inputs: GeographyResolverInputs) =>
	new GeographyResolver(inputs);
