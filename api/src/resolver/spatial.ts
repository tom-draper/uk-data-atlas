import type { AreaRecord } from "../areaInventory";
import type {
	AreaGeometryCache,
	AreaGeometryCacheStats,
	GeoJsonGeometry,
	IntersectingArea,
} from "../areaGeometry";
import { distanceToBoundaryM } from "../areaDistance";
import type { Neighbour } from "../areaNeighbours";
import type { GeometryBounds, PointContainment } from "../areaContainment";
import type { GeometryProvenance } from "../reprojection";
import { areaId, type AreaIdentity } from "./areas";

export type ResolvedContainingArea = AreaRecord & { id: string; containment: PointContainment; distanceToBoundaryM: number; geometrySource: GeometryProvenance };
export type ResolvedNearbyArea = AreaRecord & { id: string; distanceM: number; geometrySource: GeometryProvenance };
export type ResolvedNearbyAreas = { matched: number; nearest: ResolvedNearbyArea[] };
export type ResolvedAreaGeometry = AreaRecord & { id: string; geometry: GeoJsonGeometry; geometrySource: GeometryProvenance };
export type ResolvedGeometry = { geometry: GeoJsonGeometry; geometrySource: GeometryProvenance };
export type ResolvedIntersectingArea = AreaRecord & { id: string; relation: IntersectingArea["relation"]; boundingBox: GeometryBounds; geometry: GeoJsonGeometry; geometrySource: GeometryProvenance };
export type ResolvedIntersectingAreas = { matched: number; matches: ResolvedIntersectingArea[] };
export type ResolvedAreaNeighbour = Neighbour & { id: string; area?: AreaRecord };
export type ResolvedAreaNeighbours = { geometry: GeoJsonGeometry; neighbours: ResolvedAreaNeighbour[] };

/** Geometry queries and provenance over a compiled geometry cache. */
export class SpatialResolver {
	constructor(
		private readonly cache: AreaGeometryCache | undefined,
		private readonly area: (identity: AreaIdentity) => AreaRecord | undefined,
	) {}

	hasAreaGeometryCache(): boolean { return this.cache !== undefined; }
	geometryCacheStats(): AreaGeometryCacheStats | undefined { return this.cache?.stats(); }

	geometryFor(identity: AreaIdentity): ResolvedGeometry | undefined {
		const geometry = this.cache?.get(identity.geography, identity.boundaryRelease, identity.code);
		return geometry && this.cache ? { geometry, geometrySource: this.cache.provenance(identity.geography, identity.boundaryRelease, identity.code) } : undefined;
	}

	areaGeometry(identity: AreaIdentity): ResolvedAreaGeometry | undefined {
		const area = this.area(identity);
		const resolved = this.geometryFor(identity);
		return area && resolved ? { id: areaId(identity), ...area, ...resolved } : undefined;
	}

	areaNeighbours(identity: AreaIdentity): ResolvedAreaNeighbours | undefined {
		const cache = this.cache;
		if (!cache) return undefined;
		const neighbours = cache.findNeighbours(identity.geography, identity.boundaryRelease, identity.code);
		const geometry = cache.get(identity.geography, identity.boundaryRelease, identity.code);
		if (!neighbours || !geometry) return undefined;
		return { geometry, neighbours: neighbours.map((neighbour) => ({
			...neighbour,
			id: areaId({ geography: identity.geography, boundaryRelease: identity.boundaryRelease, code: neighbour.code }),
			area: this.area({ geography: identity.geography, boundaryRelease: identity.boundaryRelease, code: neighbour.code }),
		})) };
	}

	containingAreas(geography: string, boundaryRelease: string, point: [number, number]): ResolvedContainingArea[] | undefined {
		const cache = this.cache;
		if (!cache) return undefined;
		return cache.findContaining(geography, boundaryRelease, point).flatMap(({ code, containment }) => {
			const area = this.area({ geography, boundaryRelease, code });
			const geometry = cache.get(geography, boundaryRelease, code);
			return area && geometry ? [{ id: areaId({ geography, boundaryRelease, code }), ...area, containment, distanceToBoundaryM: distanceToBoundaryM(point, geometry), geometrySource: cache.provenance(geography, boundaryRelease, code) }] : [];
		});
	}

	nearestAreas(geography: string, boundaryRelease: string, point: [number, number], { withinM, limit }: { withinM: number; limit: number }): ResolvedNearbyAreas | undefined {
		const cache = this.cache;
		if (!cache) return undefined;
		const found = cache.findNearest(geography, boundaryRelease, point, withinM).flatMap(({ code, distanceM }) => {
			const area = this.area({ geography, boundaryRelease, code });
			return area ? [{ code, area, distanceM }] : [];
		});
		return { matched: found.length, nearest: found.slice(0, limit).map(({ code, area, distanceM }) => ({ id: areaId({ geography, boundaryRelease, code }), ...area, distanceM, geometrySource: cache.provenance(geography, boundaryRelease, code) })) };
	}

	releaseGeometrySource(geography: string, boundaryRelease: string): GeometryProvenance | undefined {
		return this.cache?.provenance(geography, boundaryRelease);
	}

	intersectingAreas(geography: string, boundaryRelease: string, box: GeometryBounds): ResolvedIntersectingAreas | undefined {
		const cache = this.cache;
		if (!cache) return undefined;
		const found = cache.findIntersecting(geography, boundaryRelease, box);
		return { matched: found.length, matches: found.flatMap(({ code, relation, bounds }) => {
			const area = this.area({ geography, boundaryRelease, code });
			const geometry = cache.get(geography, boundaryRelease, code);
			return area && geometry ? [{ id: areaId({ geography, boundaryRelease, code }), ...area, relation, boundingBox: bounds, geometry, geometrySource: cache.provenance(geography, boundaryRelease, code) }] : [];
		}) };
	}
}
