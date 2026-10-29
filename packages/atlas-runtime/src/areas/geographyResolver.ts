import type { AreaRelation } from "@uk-data-atlas/relationships";
import type {
	AreaInventory,
	AreaLookup,
	AreaRecord,
} from "@uk-data-atlas/areas";

import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { GeographyInventory } from "./geographyInventory";
import type { AreaGeometryCache } from "../geometry/areaGeometry";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { LocationProjections } from "../places/locationProjections";
import type {
	NamedLocationInventory,
	NamedLocationLookup,
} from "../places/namedLocations";
import type { AreaSearchIndex } from "./areaSearch";
import type { PlaceIndex } from "../places/placeIndex";
import type { PostcodeAreaIndex } from "@uk-data-atlas/postcodes";
import type { PostcodeCountsIndex } from "@uk-data-atlas/postcodes";
import type { PostcodeIndex } from "@uk-data-atlas/postcodes";
import type { RelationshipPath } from "@uk-data-atlas/relationships";
import type { RelationshipCandidateInventory } from "../relationships/relationshipCandidates";
import {
	AreasResolver,
	type AreaIdentity,
	type GeographyEndpoint,
} from "./resolver/areas";
import { AreaValidation } from "./resolver/areaValidation";
import { CatalogueResolver } from "./resolver/catalogue";
import { CapabilityResolver } from "./resolver/capability";
import { LineageResolver } from "./resolver/lineage";
import {
	compareBoundaryReleases,
	type BoundaryReleaseComparison,
} from "./resolver/releaseComparison";
import { LocationsResolver } from "./resolver/locations";
import { PostcodeResolver } from "./resolver/postcodes";
import {
	SpatialResolver,
	type ResolvedContainingArea,
} from "./resolver/spatial";
import {
	CrosswalkTranslator,
	type CrosswalkLookup,
	type ResolvedAreaTranslation,
} from "@uk-data-atlas/relationships";

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
} from "@uk-data-atlas/relationships";
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
	placeIndex?: PlaceIndex;
	/** Every area identity by code, name and alias, compiled with the area inventory. */
	areaSearchIndex?: AreaSearchIndex;
	/** Every unit postcode's centroid, compiled from the ONS Postcode Directory. */
	postcodeIndex?: PostcodeIndex;
	/** The areas each postcode falls in, compiled for the releases read most. */
	postcodeAreaIndex?: PostcodeAreaIndex;
	/** Per-area postcode counts, derived from the compiled postcode placements. */
	postcodeCountsIndex?: PostcodeCountsIndex;
	locationProjectionStore?: LocationProjections;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
};

export const createGeographyServices = (inputs: GeographyResolverInputs) => {
	const areas = new AreasResolver(inputs);
	const catalogue = new CatalogueResolver(inputs);
	const locations = new LocationsResolver(inputs, catalogue);
	const spatial = new SpatialResolver(inputs.areaGeometryCache, (identity) =>
		areas.area(identity),
	);
	const postcodes = new PostcodeResolver(inputs);
	const lineage = new LineageResolver(
		inputs.crosswalkLookup,
		(identity) => areas.area(identity),
		(identity) => areas.sameCode(identity),
	);
	const translator = new CrosswalkTranslator(inputs);
	const validation = new AreaValidation(areas, lineage, translator);
	const capability = new CapabilityResolver(
		inputs,
		translator,
		(identity, only) => lineage.relationships(identity, only),
		() => lineage.hasAreaRelationships(),
		(geography, release) => areas.boundaryRelease(geography, release),
		(geography, release) => lineage.relatedCodes(geography, release),
	);
	return {
		areas,
		catalogue,
		locations,
		spatial,
		postcodes,
		lineage,
		translator,
		validation,
		capability,
	};
};

/** Read-only public facade over focused immutable-artifact resolvers. */
export class GeographyResolver {
	private readonly areas: AreasResolver;
	private readonly catalogue: CatalogueResolver;
	private readonly locations: LocationsResolver;
	private readonly spatial: SpatialResolver;
	private readonly postcodes: PostcodeResolver;
	private readonly lineage: LineageResolver;
	private readonly translator: CrosswalkTranslator;
	private readonly capability: CapabilityResolver;

	constructor(
		private readonly inputs: GeographyResolverInputs,
		services = createGeographyServices(inputs),
	) {
		this.areas = services.areas;
		this.catalogue = services.catalogue;
		this.locations = services.locations;
		this.spatial = services.spatial;
		this.postcodes = services.postcodes;
		this.lineage = services.lineage;
		this.translator = services.translator;
		this.capability = services.capability;
	}

	/** Describe a required geography input when it is absent. */
	missingRequirement(requirement: GeographyRequirement): string | undefined {
		// Only the requested check runs: some, such as the place index, load
		// a large artifact the first time they are asked.
		const available: Record<GeographyRequirement, () => boolean> = {
			areas: () => this.areas.hasAreas(),
			places: () => this.areas.hasPlaceIndex(),
			"area-search": () => this.areas.hasAreaSearch(),
			postcodes: () => this.postcodes.postcodeIndex() !== undefined,
			geometry: () => this.spatial.hasAreaGeometryCache(),
			relationships: () => this.lineage.hasAreaRelationships(),
			"named-locations": () => this.locations.hasNamedLocationInventory(),
			"location-projections": () =>
				this.locations.hasLocationProjectionStore(),
			crosswalks: () => this.translator.hasCrosswalks(),
		};
		if (available[requirement]()) return undefined;
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
		return descriptions[requirement];
	}

	geographyInventory() {
		return this.inputs.geographyInventory;
	}

	postcodeIndex() {
		return this.postcodes.postcodeIndex();
	}
	postcodeContainingAreas(
		postcode: string,
		geography: string,
		boundaryRelease: string,
	): ResolvedContainingArea[] | undefined {
		return this.postcodes.postcodeContainingAreas(
			postcode,
			geography,
			boundaryRelease,
			this.spatial,
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
	containingCodes(
		geography: string,
		boundaryRelease: string,
		point: [number, number],
	) {
		return this.spatial.containingCodes(geography, boundaryRelease, point);
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
		after?: string,
	) {
		return this.spatial.intersectingAreas(
			geography,
			boundaryRelease,
			box,
			limit,
			includeGeometry,
			after,
		);
	}

	relationships(identity: AreaIdentity, only?: AreaRelation) {
		return this.lineage.relationships(identity, only);
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
	sameArea(source: AreaIdentity, to: GeographyEndpoint) {
		return this.translator.sameArea(source, to);
	}
	successorArea(source: AreaIdentity, to: GeographyEndpoint) {
		return this.translator.successorArea(source, to);
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

export const createGeographyResolver = (
	inputs: GeographyResolverInputs,
	services?: ReturnType<typeof createGeographyServices>,
) => new GeographyResolver(inputs, services);
