import type { AreaLookup, AreaRecord } from "./areaInventory";
import type {
	AreaGeometryCache,
	GeoJsonGeometry,
	IntersectingArea,
} from "./areaGeometry";
import type { GeometryBounds, PointContainment } from "./areaContainment";
import {
	createAreaSearchIndex,
	searchAreas,
	type AreaSearchIndex,
} from "./areaSearch";
import {
	createAreaRelationshipIndex,
	type AreaRelationship,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import { crosswalksTo } from "./locationMembership";
import {
	type LocationProjectionStore,
	type LocationProjection,
} from "./locationProjections";
import type { NamedLocation, NamedLocationLookup } from "./namedLocations";
import type {
	RelationshipPath,
	RelationshipPurpose,
} from "./relationshipPaths";
import type { GeometryProvenance } from "./reprojection";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

export type ResolvedContainingArea = AreaRecord & {
	id: string;
	containment: PointContainment;
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

type AreaIdentity = {
	geography: string;
	boundaryRelease: string;
	code: string;
};

export type GeographyResolverInputs = {
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	areaGeometryCache?: AreaGeometryCache;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjectionStore;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
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

	constructor(private readonly inputs: GeographyResolverInputs) {
		if (inputs.areaLookup) {
			this.areaSearchIndex = createAreaSearchIndex(inputs.areaLookup);
		}
		if (inputs.crosswalkLookup) {
			this.areaRelationshipIndex = createAreaRelationshipIndex(
				inputs.crosswalkLookup.values(),
			);
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
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								containment,
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
		return this.areaSearchIndex ? searchAreas(this.areaSearchIndex, query) : [];
	}

	relationships(identity: AreaIdentity): AreaRelationship[] {
		return this.areaRelationshipIndex?.get(areaId(identity)) ?? [];
	}

	namedLocation(id: string): NamedLocation | undefined {
		return this.inputs.namedLocationLookup?.get(id);
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

	/** Crosswalks from a target geography/release into a location's LAD members. */
	crosswalksToLocationMembers(
		geography: string,
		boundaryRelease: string,
		memberGeography: string,
	) {
		const direct = this.crosswalksBySource.get(
			[geography, boundaryRelease, memberGeography].join("/"),
		);
		return direct ??
			(this.inputs.crosswalkInventory
				? crosswalksTo(
						this.inputs.crosswalkInventory,
						geography,
						boundaryRelease,
						memberGeography,
					)
				: []);
	}
}

export const createGeographyResolver = (inputs: GeographyResolverInputs) =>
	new GeographyResolver(inputs);
