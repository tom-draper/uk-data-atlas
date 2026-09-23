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
import type { CapabilityStatus } from "./capability";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type { GeometryProvenance } from "./reprojection";
import {
	derivedReleaseSources,
	selectReleaseForDate,
	type ReleaseSelection,
} from "./releaseForDate";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

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

type GeographyEndpoint = { geography: string; boundaryRelease: string };

export type AreaIdentity = GeographyEndpoint & { code: string };

type CrosswalkSource = CrosswalkArtifact["records"][number]["source"];
type CrosswalkTarget = CrosswalkArtifact["records"][number]["targets"][number];
type TranslationTarget = CrosswalkSource | CrosswalkTarget;
type TranslationStep = {
	source: CrosswalkSource;
	targets: TranslationTarget[];
	sourceCoverage?: number;
};

export type ResolvedAreaTranslation = {
	/** The published direct or composed route that produced these targets. */
	path: RelationshipPath;
	source: CrosswalkSource;
	targets: TranslationTarget[];
	/** Present when a reverse overlap route was normalised to the queried area. */
	sourceCoverage?: number;
};

export type RelationshipPathStepCoverage = {
	crosswalkId: string;
	direction: "forward" | "reverse";
	status: "complete" | "partial" | "not-built";
	mappedSourceAreaCount?: number;
	sourceAreaCount?: number;
	share?: number;
	missingPrerequisite?: string;
};

export type ResolvedRelationshipPath = RelationshipPath & {
	operations: {
		permitted: string[];
		prohibited: string[];
		note: string;
	};
	trust: {
		level: "verified" | "derived" | "partial" | "not-built";
		reasons: string[];
	};
	coverage: {
		status: "complete" | "partial" | "not-built";
		mappedSourceAreaCount?: number;
		sourceAreaCount?: number;
		share?: number;
		steps: RelationshipPathStepCoverage[];
	};
};

export type RelationshipPrerequisite = {
	id:
		| "source-areas"
		| "target-areas"
		| "path-step-areas"
		| "crosswalk-artifact"
		| "relationship-path";
	status: Extract<CapabilityStatus, "not-built" | "unsupported">;
	reason: string;
};

export type ResolvedRelationshipCapability = {
	status: Extract<CapabilityStatus, "available" | "partial" | "unsupported" | "not-built">;
	paths: ResolvedRelationshipPath[];
	missingPrerequisites: RelationshipPrerequisite[];
};

export type ResolvedRelationshipCoverage = {
	areaCount: number;
	relatedAreaCount: number;
	relationshipCount: number;
	byRelation: Partial<Record<AreaRelation, number>>;
	crosswalkIds: string[];
	uncoveredAreas: Array<AreaRecord & { id: string }>;
};

/**
 * Where a release can actually carry data, which is not the same question as
 * whether its areas have relationships. A release whose only published paths
 * lead to other vintages of its own geography is joined up with its own
 * history and converts onto nothing new.
 */
export type GeographyReach = {
	status: "connected" | "vintage-only" | "isolated";
	/** Other geographies a published path converts this release onto. */
	reaches: string[];
	/** Other geographies a published path converts onto this release. */
	reachedFrom: string[];
	/** Paths to and from other vintages of this release's own geography. */
	vintagePathCount: number;
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

const relationshipPurposeFor = (
	crosswalk: CrosswalkArtifact,
): RelationshipPurpose | undefined =>
	crosswalk.relationshipPurpose ??
		(crosswalk.method === "official-lookup"
			? "identity"
			: crosswalk.method === "clean-containment" ||
				  crosswalk.method === "geometric-containment"
				? "membership"
				: crosswalk.method === "area-overlap" ||
					  crosswalk.method === "population-overlap"
					? "apportion"
					: crosswalk.method === "same-code-continuity"
						? "identity"
						: undefined);

const directRelationshipPath = (
	crosswalk: CrosswalkArtifact,
	direction: "forward" | "reverse",
	purpose: RelationshipPurpose,
): RelationshipPath => ({
	id: `${crosswalk.id}/${direction}/${purpose}`,
	purpose,
	from: direction === "forward" ? crosswalk.from : crosswalk.to,
	to: direction === "forward" ? crosswalk.to : crosswalk.from,
	quality: crosswalk.quality,
	origin: "crosswalk",
	steps: [
		{
			crosswalkId: crosswalk.id,
			direction,
			method: crosswalk.method,
			purpose,
		},
	],
});

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
	private readonly stepTargetCache = new Map<string, Map<string, string[]>>();
	/** Directional record indexes make code translation an indexed read. */
	private readonly translationStepCache = new Map<
		string,
		Map<string, TranslationStep>
	>();
	private readonly pathReachCache = new Map<string, number>();
	private reachByRelease?: Map<string, GeographyReach>;

	constructor(private readonly inputs: GeographyResolverInputs) {
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
		from: { geography: string; boundaryRelease: string },
		to: { geography: string; boundaryRelease: string },
		purpose: RelationshipPurpose,
	) {
		return (
			this.inputs.relationshipPathIndex?.get(
				[
					from.geography,
					from.boundaryRelease,
					to.geography,
					to.boundaryRelease,
					purpose,
				].join("/"),
			) ?? []
		);
	}

	/**
	 * Published paths are the authority for a conversion. A small direct-path
	 * fallback keeps a resolver useful when a consumer has loaded crosswalk
	 * artifacts but not the separately compiled path inventory, such as a
	 * focused test or an intentionally small deployment.
	 */
	private translationPaths(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): RelationshipPath[] {
		const published = this.relationshipPaths(from, to, purpose);
		const paths =
			published.length > 0
				? published
				: [...(this.inputs.crosswalkLookup?.values() ?? [])].flatMap(
						(crosswalk) => {
							if (relationshipPurposeFor(crosswalk) !== purpose) return [];
							const forward =
								crosswalk.from.geography === from.geography &&
								crosswalk.from.boundaryRelease === from.boundaryRelease &&
								crosswalk.to.geography === to.geography &&
								crosswalk.to.boundaryRelease === to.boundaryRelease;
							const reverse =
								crosswalk.to.geography === from.geography &&
								crosswalk.to.boundaryRelease === from.boundaryRelease &&
								crosswalk.from.geography === to.geography &&
								crosswalk.from.boundaryRelease === to.boundaryRelease;
							return forward
								? [directRelationshipPath(crosswalk, "forward", purpose)]
								: reverse
									? [directRelationshipPath(crosswalk, "reverse", purpose)]
									: [];
					},
					);
		return [...paths].sort((left, right) => {
			const origin = { crosswalk: 0, declared: 1, discovered: 2 } as const;
			const quality = { "publisher-supplied": 0, derived: 1 } as const;
			return (
				origin[left.origin] - origin[right.origin] ||
				quality[left.quality] - quality[right.quality] ||
				left.steps.length - right.steps.length ||
				left.id.localeCompare(right.id)
			);
		});
	}

	/** Build each crosswalk direction once; routes never scan its records. */
	private translationSteps(
		artifact: CrosswalkArtifact,
		direction: "forward" | "reverse",
	): Map<string, TranslationStep> {
		const key = `${artifact.id}/${direction}`;
		const cached = this.translationStepCache.get(key);
		if (cached) return cached;
		const steps = new Map<string, TranslationStep>();
		if (direction === "forward") {
			for (const record of artifact.records)
				steps.set(record.source.code, {
					source: record.source,
					targets: record.targets,
				});
		} else if (
			artifact.method === "area-overlap" ||
			artifact.method === "population-overlap"
		) {
			const recordsByTarget = new Map<
				string,
				Array<{
					record: CrosswalkArtifact["records"][number];
					target: CrosswalkTarget;
				}>
			>();
			for (const record of artifact.records) {
				for (const target of record.targets) {
					const records = recordsByTarget.get(target.code) ?? [];
					records.push({ record, target });
					recordsByTarget.set(target.code, records);
				}
			}
			for (const [code, records] of recordsByTarget) {
				const sourceCoverage = records.reduce(
					(sum, { target }) => sum + target.targetShare,
					0,
				);
				if (sourceCoverage <= 0) continue;
				steps.set(code, {
					source: {
						code,
						labels: [
							...new Set(records.flatMap(({ target }) => target.labels)),
						].sort(),
					},
					sourceCoverage,
					targets: records.map(({ record, target }) => ({
						...record.source,
						weight: target.targetShare / sourceCoverage,
						overlapAreaM2: target.overlapAreaM2,
						sourceShare: target.targetShare,
						targetShare: target.sourceShare,
					})),
				});
			}
		} else {
			const targetsBySource = new Map<string, TranslationTarget[]>();
			const labelsBySource = new Map<string, string[]>();
			for (const record of artifact.records) {
				for (const target of record.targets) {
					const targets = targetsBySource.get(target.code) ?? [];
					targets.push(record.source);
					targetsBySource.set(target.code, targets);
					const labels = labelsBySource.get(target.code) ?? [];
					labels.push(...target.labels);
					labelsBySource.set(target.code, labels);
				}
			}
			for (const [code, targets] of targetsBySource)
				steps.set(code, {
					source: {
						code,
						labels: [...new Set(labelsBySource.get(code) ?? [])].sort(),
					},
					targets,
				});
		}
		this.translationStepCache.set(key, steps);
		return steps;
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
		return this.translationPaths(source, to, purpose).flatMap((path) => {
			const first = path.steps[0];
			if (!first) return [];
			const firstArtifact = this.inputs.crosswalkLookup?.get(first.crosswalkId);
			if (!firstArtifact) return [];
			const firstStep = this.translationSteps(
				firstArtifact,
				first.direction,
			).get(source.code);
			if (!firstStep) return [];
			if (path.steps.length === 1)
				return [{ path, ...firstStep }];

			let targets = firstStep.targets;
			for (const step of path.steps.slice(1)) {
				const artifact = this.inputs.crosswalkLookup?.get(step.crosswalkId);
				if (!artifact) return [];
				const steps = this.translationSteps(artifact, step.direction);
				targets = targets.flatMap((target) => {
					const translated = steps.get(target.code);
					if (!translated) return [];
					return translated.targets.map((next) =>
						purpose === "apportion"
							? {
								...next,
								weight:
									("weight" in target ? target.weight : 1) *
									("weight" in next ? next.weight : 1),
							}
							: next,
					);
				});
				if (targets.length === 0) return [];
			}
			const combined = new Map<string, TranslationTarget>();
			for (const target of targets) {
				const previous = combined.get(target.code);
				if (!previous) {
					combined.set(target.code, target);
					continue;
				}
				combined.set(target.code, {
					...previous,
					labels: [...new Set([...previous.labels, ...target.labels])].sort(),
					...(purpose === "apportion"
						? {
								weight:
									("weight" in previous ? previous.weight : 0) +
									("weight" in target ? target.weight : 0),
							}
						: {}),
				});
			}
			return [
				{
					path,
					source: firstStep.source,
					targets: [...combined.values()].sort((left, right) =>
						left.code.localeCompare(right.code),
					),
				},
			];
		});
	}

	/** Each source code of one crosswalk direction and the codes it reaches. */
	private stepTargets(
		artifact: CrosswalkArtifact,
		direction: "forward" | "reverse",
	): Map<string, string[]> {
		const key = `${artifact.id}/${direction}`;
		const cached = this.stepTargetCache.get(key);
		if (cached) return cached;
		const targets = new Map<string, string[]>();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				const [from, to] =
					direction === "forward"
						? [record.source.code, target.code]
						: [target.code, record.source.code];
				const reached = targets.get(from) ?? [];
				reached.push(to);
				targets.set(from, reached);
			}
		}
		this.stepTargetCache.set(key, targets);
		return targets;
	}

	/**
	 * How many of a path's source areas reach its target through every step.
	 * Walking back from the last step, each step keeps the codes with a target
	 * the next step still carries, so the pass is linear in the records.
	 */
	private pathReach(path: RelationshipPath, from: GeographyEndpoint) {
		const cached = this.pathReachCache.get(path.id);
		if (cached !== undefined) return cached;
		let carried: Set<string> | undefined;
		for (const step of [...path.steps].reverse()) {
			const artifact = this.inputs.crosswalkLookup?.get(step.crosswalkId);
			if (!artifact) return undefined;
			const kept = new Set<string>();
			for (const [code, targets] of this.stepTargets(artifact, step.direction))
				if (!carried || targets.some((target) => carried!.has(target)))
					kept.add(code);
			carried = kept;
		}
		const sources = this.inputs.areaLookup?.get(
			`${from.geography}/${from.boundaryRelease}`,
		);
		const reach = sources
			? [...(carried ?? [])].filter((code) => sources.has(code)).length
			: (carried?.size ?? 0);
		this.pathReachCache.set(path.id, reach);
		return reach;
	}

	/**
	 * Explains whether an exact conversion is usable, including the source
	 * coverage of each declared path and every artifact that is still needed to
	 * make that claim. This keeps route handlers out of crosswalk internals.
	 */
	relationshipCapability(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): ResolvedRelationshipCapability {
		const missingPrerequisites: RelationshipPrerequisite[] = [];
		const endpointAreaCount = (endpoint: GeographyEndpoint) => {
			const lookupCount = this.inputs.areaLookup?.get(
				`${endpoint.geography}/${endpoint.boundaryRelease}`,
			)?.size;
			if (lookupCount !== undefined) return lookupCount;
			const release = this.inputs.areaInventory?.releases.find(
				(candidate) =>
					candidate.geography === endpoint.geography &&
					candidate.id === endpoint.boundaryRelease,
			);
			return release?.status === "available" ? release.recordCount : undefined;
		};
		const sourceAreaCount = endpointAreaCount(from);
		const targetAreaCount = endpointAreaCount(to);
		if (sourceAreaCount === undefined) {
			missingPrerequisites.push({
				id: "source-areas",
				status: "not-built",
				reason: `No compiled area identity artifact is available for ${from.geography}/${from.boundaryRelease}.`,
			});
		}
		if (targetAreaCount === undefined) {
			missingPrerequisites.push({
				id: "target-areas",
				status: "not-built",
				reason: `No compiled area identity artifact is available for ${to.geography}/${to.boundaryRelease}.`,
			});
		}
		const paths = this.relationshipPaths(from, to, purpose);
		if (paths.length === 0) {
			missingPrerequisites.push({
				id: "relationship-path",
				status: "unsupported",
				reason: `No declared ${purpose} path is published from ${from.geography}/${from.boundaryRelease} to ${to.geography}/${to.boundaryRelease}.`,
			});
		}
		const resolvedPaths = paths.map((path) => {
			const steps = path.steps.map((step) => {
				const artifact = this.inputs.crosswalkLookup?.get(step.crosswalkId);
				if (!artifact) {
					const reason = `The crosswalk artifact ${step.crosswalkId} required by ${path.id} is not built.`;
					if (!missingPrerequisites.some((item) => item.reason === reason)) {
						missingPrerequisites.push({
							id: "crosswalk-artifact",
							status: "not-built",
							reason,
						});
					}
					return {
						crosswalkId: step.crosswalkId,
						direction: step.direction,
						status: "not-built" as const,
						missingPrerequisite: reason,
					};
				}
				const mappedSourceAreaCount = this.stepTargets(
					artifact,
					step.direction,
				).size;
				const stepSource =
					step.direction === "forward" ? artifact.from : artifact.to;
				const stepSourceAreaCount = endpointAreaCount(stepSource);
				if (stepSourceAreaCount === undefined) {
					const reason = `No compiled area identity artifact is available for ${stepSource.geography}/${stepSource.boundaryRelease}.`;
					if (!missingPrerequisites.some((item) => item.reason === reason)) {
						missingPrerequisites.push({
							id: "path-step-areas",
							status: "not-built",
							reason,
						});
					}
					return {
						crosswalkId: step.crosswalkId,
						direction: step.direction,
						status: "not-built" as const,
						mappedSourceAreaCount,
						missingPrerequisite: reason,
					};
				}
				const share = mappedSourceAreaCount / stepSourceAreaCount;
				return {
					crosswalkId: step.crosswalkId,
					direction: step.direction,
					status: share === 1 ? ("complete" as const) : ("partial" as const),
					mappedSourceAreaCount,
					sourceAreaCount: stepSourceAreaCount,
					share,
				};
			});
			// A composed path loses whatever any step drops, so its coverage is the
			// share of source areas that reach the target through every step.
			const reached = steps.some((step) => step.status === "not-built")
				? undefined
				: this.pathReach(path, from);
			const share =
				reached !== undefined && sourceAreaCount
					? reached / sourceAreaCount
					: undefined;
			const coverageStatus =
				reached === undefined
					? ("not-built" as const)
					: share === 1
						? ("complete" as const)
						: ("partial" as const);
			const trust =
				coverageStatus === "not-built"
					? {
							level: "not-built" as const,
							reasons: ["A required crosswalk or area identity artifact is not built."],
						}
					: coverageStatus === "partial"
						? {
								level: "partial" as const,
								reasons: ["The declared path does not cover every source area."],
							}
						: path.origin === "discovered"
							? {
									level: "derived" as const,
									reasons: [
										"The build's path search composed this path under its composition rules; no one has reviewed it.",
										...(path.quality === "derived"
											? ["At least one path step is derived rather than publisher-supplied."]
											: []),
									],
								}
						: path.quality === "derived"
							? {
									level: "derived" as const,
									reasons: ["At least one path step is derived rather than publisher-supplied."],
								}
							: {
									level: "verified" as const,
									reasons: ["Every path step is publisher-supplied and has complete compiled coverage."],
								};
			return {
				...path,
				operations:
					path.purpose === "identity"
						? {
								permitted: ["identity-join", "code-translation"],
								prohibited: ["weighted-allocation", "containment-aggregation"],
								note: "Use this path to identify the declared equivalent area; it does not supply weights or membership.",
							}
						: path.purpose === "membership"
							? {
								permitted: ["containment-aggregation", "membership-join"],
								prohibited: ["weighted-allocation"],
								note: "Use this path to group members under a parent. It does not allocate a source value across overlapping targets.",
							}
							: {
								permitted: ["weighted-allocation"],
								prohibited: ["identity-join"],
								note: "Use this path only for measures whose semantics permit the published overlap weighting.",
							},
				trust,
				coverage: {
					status: coverageStatus,
					mappedSourceAreaCount: reached,
					sourceAreaCount,
					share,
					steps,
				},
			} satisfies ResolvedRelationshipPath;
		});
		const hasUnbuilt = missingPrerequisites.some(
			(item) => item.status === "not-built",
		);
		return {
			status:
				resolvedPaths.length === 0
					? hasUnbuilt
						? "not-built"
						: "unsupported"
					: resolvedPaths.some((path) => path.coverage.status === "partial")
						? "partial"
						: resolvedPaths.some((path) => path.coverage.status === "not-built")
							? "not-built"
							: "available",
			paths: resolvedPaths,
			missingPrerequisites,
		};
	}

	/** Every declared conversion starting at one exact release, grouped safely by endpoint and purpose. */
	relationshipCapabilitiesFrom(from: GeographyEndpoint) {
		const discovered = new Map<
			string,
			{ to: GeographyEndpoint; purpose: RelationshipPurpose }
		>();
		for (const paths of this.inputs.relationshipPathIndex?.values() ?? []) {
			for (const path of paths) {
				if (
					path.from.geography !== from.geography ||
					path.from.boundaryRelease !== from.boundaryRelease
				)
					continue;
				const key = [path.to.geography, path.to.boundaryRelease, path.purpose].join("/");
				discovered.set(key, { to: path.to, purpose: path.purpose });
			}
		}
		return [...discovered.values()]
			.map(({ to, purpose }) => ({
				to,
				purpose,
				...this.relationshipCapability(from, to, purpose),
			}))
			.sort((left, right) =>
				[left.to.geography, left.to.boundaryRelease, left.purpose]
					.join("/")
					.localeCompare([right.to.geography, right.to.boundaryRelease, right.purpose].join("/")),
			);
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
	 * What each release can convert onto, and be converted from, by published
	 * path. Built once from the path inventory, because the answer for one
	 * release depends on every path in it.
	 */
	private conversionReach(): Map<string, GeographyReach> {
		if (this.reachByRelease) return this.reachByRelease;
		const reach = new Map<string, GeographyReach>();
		const entry = (geography: string, boundaryRelease: string) => {
			const key = `${geography}/${boundaryRelease}`;
			const existing = reach.get(key);
			if (existing) return existing;
			const created: GeographyReach = { status: "isolated", reaches: [], reachedFrom: [], vintagePathCount: 0 };
			reach.set(key, created);
			return created;
		};
		const add = (into: string[], geography: string) => {
			if (!into.includes(geography)) into.push(geography);
		};
		for (const paths of this.inputs.relationshipPathIndex?.values() ?? []) {
			for (const path of paths) {
				const source = entry(path.from.geography, path.from.boundaryRelease);
				const target = entry(path.to.geography, path.to.boundaryRelease);
				// A path between two vintages of one geography is continuity. It
				// keeps a code's history joined up without reaching anything new.
				if (path.from.geography === path.to.geography) {
					source.vintagePathCount += 1;
					target.vintagePathCount += 1;
					continue;
				}
				add(source.reaches, path.to.geography);
				add(target.reachedFrom, path.from.geography);
			}
		}
		for (const found of reach.values()) {
			found.reaches.sort();
			found.reachedFrom.sort();
			found.status = found.reaches.length > 0 || found.reachedFrom.length > 0
				? "connected"
				: found.vintagePathCount > 0
					? "vintage-only"
					: "isolated";
		}
		this.reachByRelease = reach;
		return reach;
	}

	/** A release-by-release relationship health report for repair prioritisation. */
	geographyHealth(): GeographyHealth[] {
		if (!this.inputs.areaLookup) return [];
		const reach = this.conversionReach();
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
