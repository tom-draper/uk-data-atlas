import type { AreaInventory, AreaLookup, AreaRecord } from "./areaInventory";
import { summariseBatch, type ValidatedValue } from "./batchValidation";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import type { AreaGeometryCache } from "./areaGeometry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { LocationProjectionStore } from "./locationProjections";
import type {
	NamedLocationInventory,
	NamedLocationLookup,
} from "./namedLocations";
import type { AreaSearchIndexArtifact } from "./areaSearch";
import type { PlaceIndexArtifact } from "./placeIndex";
import type { PostcodeAreaIndex } from "./postcodeAreas";
import type { PostcodeCounts, PostcodeCountsIndex } from "./postcodeCounts";
import type { PostcodeIndex } from "./postcodes";
import type { RelationshipPath } from "./relationshipPaths";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import {
	AreasResolver,
	type AreaIdentity,
	type GeographyEndpoint,
} from "./resolver/areas";
import { normalisePlaceName } from "./nameNormalisation";
import { CatalogueResolver } from "./resolver/catalogue";
import { CapabilityResolver } from "./resolver/capability";
import { LineageResolver } from "./resolver/lineage";
import {
	compareBoundaryReleases,
	type BoundaryReleaseComparison,
} from "./resolver/releaseComparison";
import { LocationsResolver } from "./resolver/locations";
import {
	SpatialResolver,
	type ResolvedContainingArea,
} from "./resolver/spatial";
import {
	CrosswalkTranslator,
	type CrosswalkLookup,
	type ResolvedAreaTranslation,
} from "./resolver/translation";
import { problem, type ApiResponse } from "./routeResponse";

export type GeographyRequirement =
	| "areas"
	| "places"
	| "area-search"
	| "postcodes"
	| "geometry"
	| "relationships"
	| "named-locations"
	| "location-projections"
	| "crosswalks";

export {
	RELATIONSHIP_OPERATIONS,
	type GeographyReach,
	type RelationshipOperation,
	type RelationshipPathStepCoverage,
	type RelationshipPrerequisite,
	type ResolvedConversionPlan,
	type ResolvedRelationshipCapability,
	type ResolvedRelationshipPath,
} from "./resolver/capability";
export type {
	BoundaryExtentChange,
	BoundaryReleaseComparison,
	PublishedRelationshipMapping,
} from "./resolver/releaseComparison";
export type {
	AreaIdentity,
	GeographyEndpoint,
	ResolvedSameCodeArea,
} from "./resolver/areas";
export type {
	CrosswalkLookup,
	ResolvedAreaTranslation,
} from "./resolver/translation";
export type {
	ResolvedContainingArea,
	ResolvedNearbyArea,
	ResolvedNearbyAreas,
	ResolvedAreaGeometry,
	ResolvedGeometry,
	ResolvedIntersectingArea,
	ResolvedIntersectingAreas,
	ResolvedAreaNeighbour,
	ResolvedAreaNeighbours,
} from "./resolver/spatial";
export type {
	TraversedRelationship,
	ResolvedAreaHistory,
	ResolvedAreaRelationshipSummary,
} from "./resolver/lineage";
export type {
	ResolvedRelationshipCoverage,
	GeographyHealth,
	RelationshipRepair,
} from "./resolver/capability";

export type GeographyResolverInputs = {
	boundaryRegistry?: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	areaInventory?: AreaInventory;
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	areaGeometryCache?: AreaGeometryCache;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	/** Every area and named location by name, compiled with the area inventory. */
	placeIndex?: PlaceIndexArtifact;
	/** Every area identity by code, name and alias, compiled with the area inventory. */
	areaSearchIndex?: AreaSearchIndexArtifact;
	/** Every unit postcode's centroid, compiled from the ONS Postcode Directory. */
	postcodeIndex?: PostcodeIndex;
	/** The areas each postcode falls in, compiled for the releases read most. */
	postcodeAreaIndex?: PostcodeAreaIndex;
	/** Per-area postcode counts, derived from the compiled postcode placements. */
	postcodeCountsIndex?: PostcodeCountsIndex;
	locationProjectionStore?: LocationProjectionStore;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
};

/** Read-only public facade over focused immutable-artifact resolvers. */
export class GeographyResolver {
	private readonly areas: AreasResolver;
	private readonly catalogue: CatalogueResolver;
	private readonly locations: LocationsResolver;
	private readonly spatial: SpatialResolver;
	private readonly lineage: LineageResolver;
	private readonly translator: CrosswalkTranslator;
	private readonly capability: CapabilityResolver;

	constructor(private readonly inputs: GeographyResolverInputs) {
		this.areas = new AreasResolver(inputs);
		this.catalogue = new CatalogueResolver(inputs);
		this.locations = new LocationsResolver(inputs, this.catalogue);
		this.spatial = new SpatialResolver(
			inputs.areaGeometryCache,
			(identity) => this.areas.area(identity),
		);
		this.lineage = new LineageResolver(
			inputs.crosswalkLookup,
			(identity) => this.areas.area(identity),
			(identity) => this.areas.sameCode(identity),
		);
		this.translator = new CrosswalkTranslator(inputs);
		this.capability = new CapabilityResolver(
			inputs,
			this.translator,
			(identity) => this.lineage.relationships(identity),
			() => this.lineage.hasAreaRelationships(),
			(geography, release) =>
				this.areas.boundaryRelease(geography, release),
		);
	}

	/** Return the shared 503 response when a route's required geography input is absent. */
	requires(requirement: GeographyRequirement): ApiResponse | undefined {
		const available: Record<GeographyRequirement, boolean> = {
			areas: this.areas.hasAreas(),
			places: this.areas.hasPlaceIndex(),
			"area-search": this.areas.hasAreaSearch(),
			postcodes: this.inputs.postcodeIndex !== undefined,
			geometry: this.spatial.hasAreaGeometryCache(),
			relationships: this.lineage.hasAreaRelationships(),
			"named-locations": this.locations.hasNamedLocationInventory(),
			"location-projections": this.locations.hasLocationProjectionStore(),
			crosswalks: this.translator.hasCrosswalks(),
		};
		if (available[requirement]) return undefined;
		const descriptions: Record<GeographyRequirement, string> = {
			areas: "Build the area inventory before serving geography data.",
			places: "Build the place index before resolving place names.",
			"area-search":
				"Build the area search index before searching areas.",
			postcodes: "Build the postcode index before resolving postcodes.",
			geometry:
				"Build the geometry source registry before serving geometry.",
			relationships:
				"Build the crosswalk inventory before serving area relationships.",
			"named-locations":
				"Build the named location inventory before serving locations.",
			"location-projections":
				"Build the location projection inventory before serving location projections.",
			crosswalks:
				"Build the crosswalk artifacts before serving crosswalk data.",
		};
		return problem(503, "Catalogue Unavailable", descriptions[requirement]);
	}

	geographyInventory() {
		return this.inputs.geographyInventory;
	}

	postcodeIndex() {
		return this.inputs.postcodeIndex;
	}
	postcodeCounts(identity: AreaIdentity): PostcodeCounts | undefined {
		return this.inputs.postcodeCountsIndex?.forArea(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
	}
	postcodeAreaIndex() {
		return this.inputs.postcodeAreaIndex;
	}
	/**
	 * The areas of one release a unit postcode's centroid lies in, from the
	 * compiled postcode area index: the answer `containingAreas` gives for the
	 * centroid, without reading geometry. Undefined when the index does not
	 * hold the release, so the caller places the centroid live.
	 */
	postcodeContainingAreas(
		postcode: string,
		geography: string,
		boundaryRelease: string,
	): ResolvedContainingArea[] | undefined {
		const matches = this.inputs.postcodeAreaIndex?.containing(
			postcode,
			geography,
			boundaryRelease,
		);
		if (!matches) return undefined;
		return this.spatial.resolvePlacedAreas(
			geography,
			boundaryRelease,
			matches,
		);
	}

	area(identity: AreaIdentity): AreaRecord | undefined {
		return this.areas.area(identity);
	}
	codeReleases(identity: AreaIdentity) {
		return this.areas.codeReleases(identity);
	}
	releaseAreas(geography: string, boundaryRelease: string) {
		return this.areas.releaseAreas(geography, boundaryRelease);
	}
	locationReleaseViews(memberGeography: string, memberCodes: string[]) {
		return this.locations.locationReleaseViews(
			memberGeography,
			memberCodes,
		);
	}
	reconcileMembers(
		geography: string,
		boundaryRelease: string,
		memberCodes: string[],
		resolvedCodes: Set<string>,
	) {
		return this.locations.reconcileMembers(
			geography,
			boundaryRelease,
			memberCodes,
			resolvedCodes,
		);
	}
	reconcileMembersForYear(
		geography: string,
		boundaryYear: number,
		memberCodes: string[],
		resolvedCodes: Set<string>,
	) {
		return this.locations.reconcileMembersForYear(
			geography,
			boundaryYear,
			memberCodes,
			resolvedCodes,
		);
	}
	countryIdentity(code: string) {
		return this.areas.countryIdentity(code);
	}
	places(query: string, limit = 10, asOf?: string) {
		return this.areas.places(query, limit, asOf);
	}
	hasAreaRelease(geography: string, boundaryRelease: string): boolean {
		return this.areas.hasAreaRelease(geography, boundaryRelease);
	}
	areaCodes(geography: string, boundaryRelease: string) {
		return this.areas.areaCodes(geography, boundaryRelease);
	}
	areaReleases() {
		return this.areas.areaReleases();
	}
	boundaryRelease(geography: string, id: string) {
		return this.areas.boundaryRelease(geography, id);
	}
	boundaryReleasesFor(geography?: string) {
		return this.areas.boundaryReleasesFor(geography);
	}
	explainAreaAbsence(
		geography: string,
		boundaryRelease: string,
		code: string,
	) {
		return this.areas.explainAreaAbsence(geography, boundaryRelease, code);
	}
	validateAreas(
		geography: string,
		boundaryRelease: string,
		values: string[],
		parents?: string[],
	) {
		const validated = this.areas.validateAreas(
			geography,
			boundaryRelease,
			values,
		);
		if (!validated || !parents) return validated;
		const endpoint = { geography, boundaryRelease };
		const resolved = validated.values.map((value, index) =>
			this.resolveParent(value, parents[index] ?? "", endpoint),
		);
		return { values: resolved, summary: summariseBatch(resolved) };
	}

	/**
	 * Ranks compiled releases by values that resolve exactly. The leading result
	 * is a likely interpretation, never an implicit conversion or a join.
	 */
	matchAreaValues(values: string[], parents?: string[]) {
		const candidates = this.areaReleases()
			.map(({ geography, boundaryRelease }) => {
				const validated = this.validateAreas(
					geography,
					boundaryRelease,
					values,
					parents,
				);
				if (!validated) return undefined;
				const resolved = validated.values.filter(
					(value) =>
						value.status === "valid" || value.status === "matched",
				).length;
				return {
					geography,
					boundaryRelease,
					resolved,
					ambiguous: validated.values.filter(
						(value) => value.status === "ambiguous",
					).length,
					summary: validated.summary,
					values: validated.values,
				};
			})
			.filter(
				(candidate): candidate is NonNullable<typeof candidate> =>
					candidate !== undefined && candidate.resolved > 0,
			)
			.sort(
				(left, right) =>
					right.resolved - left.resolved ||
					left.ambiguous - right.ambiguous ||
					right.boundaryRelease.localeCompare(left.boundaryRelease) ||
					left.geography.localeCompare(right.geography),
			);
		const likely = candidates[0];
		const origins = likely
			? likely.values.flatMap((value) => {
					if (value.kind !== "code") return [];
					if ("presentIn" in value)
						return value.presentIn.map(({ boundaryRelease }) => ({
							geography: likely.geography,
							boundaryRelease,
						}));
					if ("heldBy" in value)
						return value.heldBy.flatMap(
							({ geography, boundaryReleases }) =>
								boundaryReleases.map((boundaryRelease) => ({
									geography,
									boundaryRelease,
								})),
						);
					return [];
				})
			: [];
		const recommendations = likely
			? [
					...new Map(
						origins.flatMap((from) =>
							(
								["identity", "membership", "apportion"] as const
							).flatMap((purpose) =>
								this.translator
									.paths(
										from,
										{
											geography: likely.geography,
											boundaryRelease:
												likely.boundaryRelease,
										},
										purpose,
									)
									.map((path) => [path.id, path] as const),
							),
						),
					).values(),
				]
			: [];
		const mixedCodeSystems = likely?.values.some(
			(value) =>
				value.kind === "code" &&
				(value.status === "other-geography" || "presentIn" in value),
		);
		// Releases that resolve the values exactly as well as the likely one,
		// which the values alone cannot tell apart; the newest leads only by
		// the sort, so they are named rather than passed over.
		const tiedWith = likely
			? candidates
					.slice(1)
					.filter(
						(candidate) =>
							candidate.resolved === likely.resolved &&
							candidate.ambiguous === likely.ambiguous,
					)
					.map(({ geography, boundaryRelease }) => ({
						geography,
						boundaryRelease,
					}))
			: [];
		return {
			likely: likely && {
				geography: likely.geography,
				boundaryRelease: likely.boundaryRelease,
				resolved: likely.resolved,
				summary: likely.summary,
				...(tiedWith.length > 0 ? { tiedWith } : {}),
			},
			candidates: candidates
				.slice(0, 10)
				.map(({ values: _values, ...candidate }) => candidate),
			values: likely?.values ?? [],
			verdict: !likely
				? "unmatched"
				: likely.summary.joinable
					? "joinable"
					: mixedCodeSystems
						? "mixed-code-systems"
						: "incomplete",
			recommendations,
		};
	}

	private resolveParent(
		value: ValidatedValue,
		parentValue: string,
		endpoint: GeographyEndpoint,
	): ValidatedValue {
		if (value.kind !== "name" || value.status !== "ambiguous") return value;
		const parent = parentValue.trim();
		if (!parent) return value;
		const parentCode = parent.toUpperCase();
		const parentName = normalisePlaceName(parent);
		const candidates = value.candidates.filter((candidate) => {
			const relationships = this.relationships({
				...endpoint,
				code: candidate.code,
			}).filter((relationship) => relationship.relation === "within");
			return relationships.some(
				(relationship) =>
					relationship.counterpart.code === parentCode ||
					relationship.counterpart.labels.some(
						(label) => normalisePlaceName(label) === parentName,
					),
			);
		});
		if (candidates.length !== 1) return value;
		const candidate = candidates[0]!;
		const relationship = this.relationships({
			...endpoint,
			code: candidate.code,
		}).find(
			(entry) =>
				entry.relation === "within" &&
				(entry.counterpart.code === parentCode ||
					entry.counterpart.labels.some(
						(label) => normalisePlaceName(label) === parentName,
					)),
		)!;
		const { candidates: _candidates, ...base } = value;
		return {
			...base,
			kind: "name",
			status: "matched",
			match: candidate.match,
			area: {
				id: candidate.id,
				code: candidate.code,
				name: candidate.name,
			},
			parent: {
				value: parentValue,
				match:
					relationship.counterpart.code === parentCode
						? "code"
						: "name",
				area: {
					id: relationship.counterpart.id,
					code: relationship.counterpart.code,
					name:
						relationship.counterpart.labels[0] ??
						relationship.counterpart.code,
				},
				crosswalk: relationship.crosswalk.id,
			},
		};
	}
	selectReleaseForDate(geography: string, month: string, country?: string) {
		return this.areas.selectReleaseForDate(geography, month, country);
	}
	searchAreas(query: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query?: string;
	}) {
		return this.areas.searchAreas(query);
	}
	exactAreaCandidates(query: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query: string;
	}) {
		return this.areas.exactAreaCandidates(query);
	}
	resolveAreaCandidates(query: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query: string;
	}) {
		return this.areas.resolveAreaCandidates(query);
	}

	geometryCacheStats() {
		return this.spatial.geometryCacheStats();
	}
	geometryFor(identity: AreaIdentity) {
		return this.spatial.geometryFor(identity);
	}
	areaGeometry(identity: AreaIdentity) {
		return this.spatial.areaGeometry(identity);
	}
	areaNeighbours(identity: AreaIdentity) {
		return this.spatial.areaNeighbours(identity);
	}
	containingAreas(
		geography: string,
		boundaryRelease: string,
		point: [number, number],
	) {
		return this.spatial.containingAreas(geography, boundaryRelease, point);
	}
	nearestAreas(
		geography: string,
		boundaryRelease: string,
		point: [number, number],
		options: { withinM: number; limit: number },
	) {
		return this.spatial.nearestAreas(
			geography,
			boundaryRelease,
			point,
			options,
		);
	}
	releaseGeometrySource(geography: string, boundaryRelease: string) {
		return this.spatial.releaseGeometrySource(geography, boundaryRelease);
	}
	intersectingAreas(
		geography: string,
		boundaryRelease: string,
		box: Parameters<SpatialResolver["intersectingAreas"]>[2],
		limit?: number,
		includeGeometry?: boolean,
	) {
		return this.spatial.intersectingAreas(
			geography,
			boundaryRelease,
			box,
			limit,
			includeGeometry,
		);
	}

	relationships(identity: AreaIdentity) {
		return this.lineage.relationships(identity);
	}
	ancestorLineage(identity: AreaIdentity, maximumDepth: number) {
		return this.lineage.ancestorLineage(identity, maximumDepth);
	}
	descendantLineage(identity: AreaIdentity, maximumDepth: number) {
		return this.lineage.descendantLineage(identity, maximumDepth);
	}
	areaRelationshipSummary(identity: AreaIdentity) {
		return this.lineage.areaRelationshipSummary(identity);
	}
	areaHistory(identity: AreaIdentity, maximumDepth = 8) {
		return this.lineage.areaHistory(identity, maximumDepth);
	}

	namedLocation(id: string, asOf?: string) {
		return this.locations.namedLocation(id, asOf);
	}
	namedLocations(asOf?: string) {
		return this.locations.namedLocations(asOf);
	}
	namedLocationsForArea(identity: AreaIdentity, asOf?: string) {
		return this.locations.namedLocationsForArea(identity, asOf);
	}
	crosswalk(id: string): CrosswalkArtifact | undefined {
		return this.translator.artifact(id);
	}
	crosswalkSummary(id: string) {
		return this.catalogue.crosswalkSummary(id);
	}
	crosswalkSummaryForArtifact(artifact: string) {
		return this.catalogue.crosswalkSummaryForArtifact(artifact);
	}
	crosswalkSummaries() {
		return this.catalogue.crosswalkSummaries();
	}
	areaIdentityRelease(geography: string, boundaryRelease: string) {
		return this.catalogue.areaIdentityRelease(geography, boundaryRelease);
	}
	areaIdentityReleaseForArtifact(artifact: string) {
		return this.catalogue.areaIdentityReleaseForArtifact(artifact);
	}
	namedLocationMembershipInventory() {
		return this.catalogue.namedLocationMembershipInventory();
	}
	locationProjection(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	) {
		return this.locations.locationProjection(
			locationId,
			geography,
			boundaryRelease,
			crosswalkId,
		);
	}
	locationMemberProjectionShards(memberGeography: string) {
		return this.locations.locationMemberProjectionShards(memberGeography);
	}
	locationParentProjectionShards(memberGeography: string) {
		return this.locations.locationParentProjectionShards(memberGeography);
	}
	locationParentCrosswalks(geography: string, boundaryRelease: string) {
		return this.locations.locationParentCrosswalks(
			geography,
			boundaryRelease,
		);
	}
	locationParents(locationId: string, crosswalkId: string) {
		return this.locations.locationParents(locationId, crosswalkId);
	}
	crosswalksToLocationMembers(
		geography: string,
		boundaryRelease: string,
		memberGeography: string,
	) {
		return this.locations.crosswalksToLocationMembers(
			geography,
			boundaryRelease,
			memberGeography,
		);
	}

	relationshipPaths(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: Parameters<CrosswalkTranslator["publishedPaths"]>[2],
	) {
		return this.translator.publishedPaths(from, to, purpose);
	}
	relationshipPath(id: string): RelationshipPath | undefined {
		return this.translator.path(id);
	}
	publishedRelationshipPaths(): RelationshipPath[] {
		return this.translator.allPaths();
	}
	indexedPathSteps(path: RelationshipPath) {
		return this.translator.indexedSteps(path);
	}
	translateArea(
		source: AreaIdentity,
		to: GeographyEndpoint,
		purpose: Parameters<CrosswalkTranslator["translateArea"]>[2],
	): ResolvedAreaTranslation[] {
		return this.translator.translateArea(source, to, purpose);
	}

	relationshipCapability(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: Parameters<CapabilityResolver["relationshipCapability"]>[2],
	) {
		return this.capability.relationshipCapability(from, to, purpose);
	}
	conversionPlan(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: Parameters<CapabilityResolver["conversionPlan"]>[2],
		operation?: Parameters<CapabilityResolver["conversionPlan"]>[3],
	) {
		return this.capability.conversionPlan(from, to, purpose, operation);
	}
	relationshipCapabilitiesFrom(from: GeographyEndpoint) {
		return this.capability.relationshipCapabilitiesFrom(from);
	}
	relationshipCoverage(
		geography: string,
		boundaryRelease: string,
		relation?: Parameters<CapabilityResolver["relationshipCoverage"]>[2],
		limit = 25,
	) {
		return this.capability.relationshipCoverage(
			geography,
			boundaryRelease,
			relation,
			limit,
		);
	}
	geographyHealth() {
		return this.capability.geographyHealth();
	}
	relationshipRepairs() {
		return this.capability.relationshipRepairs();
	}

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
}

export const createGeographyResolver = (inputs: GeographyResolverInputs) =>
	new GeographyResolver(inputs);
