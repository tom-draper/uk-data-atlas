import type { AreaInventory, AreaLookup, AreaRecord } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import type { AreaGeometryCache } from "./areaGeometry";
import type { CrosswalkArtifact, CrosswalkInventory } from "./crosswalkInventory";
import type { LocationProjectionStore } from "./locationProjections";
import type { NamedLocationInventory, NamedLocationLookup } from "./namedLocations";
import type { RelationshipPath } from "./relationshipPaths";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import { AreasResolver, type AreaIdentity, type GeographyEndpoint } from "./resolver/areas";
import { CatalogueResolver } from "./resolver/catalogue";
import { CapabilityResolver } from "./resolver/capability";
import { LineageResolver } from "./resolver/lineage";
import { compareBoundaryReleases, type BoundaryReleaseComparison } from "./resolver/releaseComparison";
import { LocationsResolver } from "./resolver/locations";
import { SpatialResolver } from "./resolver/spatial";
import { CrosswalkTranslator, type CrosswalkLookup, type ResolvedAreaTranslation } from "./resolver/translation";
import { problem, type ApiResponse } from "./routeResponse";

export type GeographyRequirement = "areas" | "geometry" | "relationships" | "named-locations" | "location-projections" | "crosswalks";

export { RELATIONSHIP_OPERATIONS, type GeographyReach, type RelationshipOperation, type RelationshipPathStepCoverage, type RelationshipPrerequisite, type ResolvedConversionPlan, type ResolvedRelationshipCapability, type ResolvedRelationshipPath } from "./resolver/capability";
export type { BoundaryExtentChange, BoundaryReleaseComparison, PublishedRelationshipMapping } from "./resolver/releaseComparison";
export type { AreaIdentity, GeographyEndpoint, ResolvedSameCodeArea } from "./resolver/areas";
export type { CrosswalkLookup, ResolvedAreaTranslation } from "./resolver/translation";
export type { ResolvedContainingArea, ResolvedNearbyArea, ResolvedNearbyAreas, ResolvedAreaGeometry, ResolvedGeometry, ResolvedIntersectingArea, ResolvedIntersectingAreas, ResolvedAreaNeighbour, ResolvedAreaNeighbours } from "./resolver/spatial";
export type { TraversedRelationship, ResolvedAreaHistory, ResolvedAreaRelationshipSummary } from "./resolver/lineage";
export type { ResolvedRelationshipCoverage, GeographyHealth, RelationshipRepair } from "./resolver/capability";

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
		this.spatial = new SpatialResolver(inputs.areaGeometryCache, (identity) => this.areas.area(identity));
		this.lineage = new LineageResolver(inputs.crosswalkLookup, (identity) => this.areas.area(identity), (identity) => this.areas.sameCode(identity));
		this.translator = new CrosswalkTranslator(inputs);
		this.capability = new CapabilityResolver(inputs, this.translator, (identity) => this.lineage.relationships(identity), () => this.lineage.hasAreaRelationships(), (geography, release) => this.areas.boundaryRelease(geography, release));
	}

	/** Return the shared 503 response when a route's required geography input is absent. */
	requires(requirement: GeographyRequirement): ApiResponse | undefined {
		const available: Record<GeographyRequirement, boolean> = {
			areas: this.areas.hasAreas(),
			geometry: this.spatial.hasAreaGeometryCache(),
			relationships: this.lineage.hasAreaRelationships(),
			"named-locations": this.locations.hasNamedLocationInventory(),
			"location-projections": this.locations.hasLocationProjectionStore(),
			crosswalks: this.translator.hasCrosswalks(),
		};
		if (available[requirement]) return undefined;
		const descriptions: Record<GeographyRequirement, string> = {
			areas: "Build the area inventory before serving geography data.",
			geometry: "Build the geometry source registry before serving geometry.",
			relationships: "Build the crosswalk inventory before serving area relationships.",
			"named-locations": "Build the named location inventory before serving locations.",
			"location-projections": "Build the location projection inventory before serving location projections.",
			crosswalks: "Build the crosswalk artifacts before serving crosswalk data.",
		};
		return problem(503, "Catalogue Unavailable", descriptions[requirement]);
	}

	geographyInventory() { return this.inputs.geographyInventory; }

	area(identity: AreaIdentity): AreaRecord | undefined { return this.areas.area(identity); }
	releaseAreas(geography: string, boundaryRelease: string) { return this.areas.releaseAreas(geography, boundaryRelease); }
	locationReleaseViews(memberGeography: string, memberCodes: string[]) { return this.locations.locationReleaseViews(memberGeography, memberCodes); }
	reconcileMembers(geography: string, boundaryRelease: string, memberCodes: string[], resolvedCodes: Set<string>) { return this.locations.reconcileMembers(geography, boundaryRelease, memberCodes, resolvedCodes); }
	reconcileMembersForYear(geography: string, boundaryYear: number, memberCodes: string[], resolvedCodes: Set<string>) { return this.locations.reconcileMembersForYear(geography, boundaryYear, memberCodes, resolvedCodes); }
	countryIdentity(code: string) { return this.areas.countryIdentity(code); }
	places(query: string, limit = 10) {
		return this.areas.places(query, limit);
	}
	hasAreaRelease(geography: string, boundaryRelease: string): boolean { return this.areas.hasAreaRelease(geography, boundaryRelease); }
	areaCodes(geography: string, boundaryRelease: string) { return this.areas.areaCodes(geography, boundaryRelease); }
	boundaryRelease(geography: string, id: string) { return this.areas.boundaryRelease(geography, id); }
	boundaryReleasesFor(geography?: string) { return this.areas.boundaryReleasesFor(geography); }
	explainAreaAbsence(geography: string, boundaryRelease: string, code: string) { return this.areas.explainAreaAbsence(geography, boundaryRelease, code); }
	validateAreas(geography: string, boundaryRelease: string, values: string[]) { return this.areas.validateAreas(geography, boundaryRelease, values); }
	selectReleaseForDate(geography: string, month: string, country?: string) { return this.areas.selectReleaseForDate(geography, month, country); }
	searchAreas(query: { geography?: string | null; boundaryRelease?: string | null; query?: string }) { return this.areas.searchAreas(query); }

	geometryCacheStats() { return this.spatial.geometryCacheStats(); }
	geometryFor(identity: AreaIdentity) { return this.spatial.geometryFor(identity); }
	areaGeometry(identity: AreaIdentity) { return this.spatial.areaGeometry(identity); }
	areaNeighbours(identity: AreaIdentity) { return this.spatial.areaNeighbours(identity); }
	containingAreas(geography: string, boundaryRelease: string, point: [number, number]) { return this.spatial.containingAreas(geography, boundaryRelease, point); }
	nearestAreas(geography: string, boundaryRelease: string, point: [number, number], options: { withinM: number; limit: number }) { return this.spatial.nearestAreas(geography, boundaryRelease, point, options); }
	releaseGeometrySource(geography: string, boundaryRelease: string) { return this.spatial.releaseGeometrySource(geography, boundaryRelease); }
	intersectingAreas(geography: string, boundaryRelease: string, box: Parameters<SpatialResolver["intersectingAreas"]>[2]) { return this.spatial.intersectingAreas(geography, boundaryRelease, box); }

	relationships(identity: AreaIdentity) { return this.lineage.relationships(identity); }
	ancestorLineage(identity: AreaIdentity, maximumDepth: number) { return this.lineage.ancestorLineage(identity, maximumDepth); }
	descendantLineage(identity: AreaIdentity, maximumDepth: number) { return this.lineage.descendantLineage(identity, maximumDepth); }
	areaRelationshipSummary(identity: AreaIdentity) { return this.lineage.areaRelationshipSummary(identity); }
	areaHistory(identity: AreaIdentity, maximumDepth = 8) { return this.lineage.areaHistory(identity, maximumDepth); }

	namedLocation(id: string) { return this.locations.namedLocation(id); }
	namedLocations() { return this.locations.namedLocations(); }
	namedLocationsForArea(identity: AreaIdentity) { return this.locations.namedLocationsForArea(identity); }
	crosswalk(id: string): CrosswalkArtifact | undefined { return this.translator.artifact(id); }
	crosswalkSummary(id: string) { return this.catalogue.crosswalkSummary(id); }
	crosswalkSummaryForArtifact(artifact: string) { return this.catalogue.crosswalkSummaryForArtifact(artifact); }
	crosswalkSummaries() { return this.catalogue.crosswalkSummaries(); }
	areaIdentityRelease(geography: string, boundaryRelease: string) { return this.catalogue.areaIdentityRelease(geography, boundaryRelease); }
	areaIdentityReleaseForArtifact(artifact: string) { return this.catalogue.areaIdentityReleaseForArtifact(artifact); }
	namedLocationMembershipInventory() { return this.catalogue.namedLocationMembershipInventory(); }
	locationProjection(locationId: string, geography: string, boundaryRelease: string, crosswalkId: string) { return this.locations.locationProjection(locationId, geography, boundaryRelease, crosswalkId); }
	locationMemberProjectionShards(memberGeography: string) { return this.locations.locationMemberProjectionShards(memberGeography); }
	locationParentProjectionShards(memberGeography: string) { return this.locations.locationParentProjectionShards(memberGeography); }
	locationParentCrosswalks(geography: string, boundaryRelease: string) { return this.locations.locationParentCrosswalks(geography, boundaryRelease); }
	locationParents(locationId: string, crosswalkId: string) { return this.locations.locationParents(locationId, crosswalkId); }
	crosswalksToLocationMembers(geography: string, boundaryRelease: string, memberGeography: string) { return this.locations.crosswalksToLocationMembers(geography, boundaryRelease, memberGeography); }

	relationshipPaths(from: GeographyEndpoint, to: GeographyEndpoint, purpose: Parameters<CrosswalkTranslator["publishedPaths"]>[2]) { return this.translator.publishedPaths(from, to, purpose); }
	relationshipPath(id: string): RelationshipPath | undefined { return this.translator.path(id); }
	publishedRelationshipPaths(): RelationshipPath[] { return this.translator.allPaths(); }
	indexedPathSteps(path: RelationshipPath) { return this.translator.indexedSteps(path); }
	translateArea(source: AreaIdentity, to: GeographyEndpoint, purpose: Parameters<CrosswalkTranslator["translateArea"]>[2]): ResolvedAreaTranslation[] { return this.translator.translateArea(source, to, purpose); }

	relationshipCapability(from: GeographyEndpoint, to: GeographyEndpoint, purpose: Parameters<CapabilityResolver["relationshipCapability"]>[2]) { return this.capability.relationshipCapability(from, to, purpose); }
	conversionPlan(from: GeographyEndpoint, to: GeographyEndpoint, purpose: Parameters<CapabilityResolver["conversionPlan"]>[2], operation?: Parameters<CapabilityResolver["conversionPlan"]>[3]) { return this.capability.conversionPlan(from, to, purpose, operation); }
	relationshipCapabilitiesFrom(from: GeographyEndpoint) { return this.capability.relationshipCapabilitiesFrom(from); }
	relationshipCoverage(geography: string, boundaryRelease: string, relation?: Parameters<CapabilityResolver["relationshipCoverage"]>[2], limit = 25) { return this.capability.relationshipCoverage(geography, boundaryRelease, relation, limit); }
	geographyHealth() { return this.capability.geographyHealth(); }
	relationshipRepairs() { return this.capability.relationshipRepairs(); }

	compareBoundaryReleases(geography: string, fromRelease: string, toRelease: string, limit = 25): BoundaryReleaseComparison | undefined {
		return compareBoundaryReleases(this.inputs, geography, fromRelease, toRelease, limit);
	}
}

export const createGeographyResolver = (inputs: GeographyResolverInputs) => new GeographyResolver(inputs);
