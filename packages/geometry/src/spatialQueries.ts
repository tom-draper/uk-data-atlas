import {
	distanceToBoundsM,
	distanceToGeometryM,
} from "@uk-data-atlas/geography/area-distance";
import {
	boundsIntersect,
	boundsWithin,
	containPoint,
	geometryMeetsBounds,
	pointInBounds,
	type Coordinate,
	type GeometryBounds,
	type PointContainment,
} from "@uk-data-atlas/geography/geometry-point-containment";
import type { GeoJsonGeometry } from "@uk-data-atlas/geography/geometry-types";
import { borderIndex, sharedBorderWith, type Neighbour } from "./borders";

export type GeometryRelease = {
	candidates(bounds: GeometryBounds): Iterable<string>;
	bounds(code: string): GeometryBounds | undefined;
	geometry(code: string): GeoJsonGeometry | undefined;
};

export type ContainingArea = {
	code: string;
	containment: Exclude<PointContainment, "outside">;
};
export type NearbyArea = { code: string; distanceM: number };
export type IntersectingArea = {
	code: string;
	relation: "within" | "overlaps";
	bounds: GeometryBounds;
};

export class SpatialQueries {
	constructor(private readonly release: GeometryRelease) {}

	findContaining(point: Coordinate): ContainingArea[] {
		const matches: ContainingArea[] = [];
		for (const code of this.release.candidates([
			point[0],
			point[1],
			point[0],
			point[1],
		])) {
			const bounds = this.release.bounds(code);
			if (!bounds || !pointInBounds(point, bounds)) continue;
			const geometry = this.release.geometry(code);
			if (!geometry) continue;
			const containment = containPoint(point, geometry);
			if (containment !== "outside") matches.push({ code, containment });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}

	findNearest(point: Coordinate, withinM: number): NearbyArea[] {
		const latitudeDelta = withinM / 110000;
		const furthestLatitude = Math.min(
			89.999,
			Math.abs(point[1]) + latitudeDelta,
		);
		const longitudeMetresPerDegree = Math.max(
			0.001,
			110000 * Math.cos((furthestLatitude * Math.PI) / 180),
		);
		const longitudeDelta = withinM / longitudeMetresPerDegree;
		const searchBounds: GeometryBounds = [
			Math.max(-180, point[0] - longitudeDelta),
			Math.max(-90, point[1] - latitudeDelta),
			Math.min(180, point[0] + longitudeDelta),
			Math.min(90, point[1] + latitudeDelta),
		];
		const nearby: NearbyArea[] = [];
		for (const code of this.release.candidates(searchBounds)) {
			const bounds = this.release.bounds(code);
			if (!bounds || distanceToBoundsM(point, bounds) > withinM) continue;
			const geometry = this.release.geometry(code);
			if (!geometry) continue;
			const distanceM = distanceToGeometryM(point, geometry);
			if (distanceM <= withinM) nearby.push({ code, distanceM });
		}
		return nearby.sort(
			(left, right) =>
				left.distanceM - right.distanceM ||
				left.code.localeCompare(right.code),
		);
	}

	findIntersecting(box: GeometryBounds): IntersectingArea[] {
		const matches: IntersectingArea[] = [];
		for (const code of this.release.candidates(box)) {
			const bounds = this.release.bounds(code);
			if (!bounds || !boundsIntersect(bounds, box)) continue;
			if (boundsWithin(bounds, box)) {
				matches.push({ code, relation: "within", bounds });
				continue;
			}
			const geometry = this.release.geometry(code);
			if (geometry && geometryMeetsBounds(geometry, box))
				matches.push({ code, relation: "overlaps", bounds });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}

	findNeighbours(code: string): Neighbour[] | undefined {
		const geometry = this.release.geometry(code);
		if (!geometry) return undefined;
		const targetBounds = this.release.bounds(code);
		if (!targetBounds) return [];
		const target = borderIndex(geometry);
		const neighbours: Neighbour[] = [];
		for (const otherCode of this.release.candidates(targetBounds)) {
			if (otherCode === code) continue;
			const otherBounds = this.release.bounds(otherCode);
			if (!otherBounds || !boundsIntersect(targetBounds, otherBounds))
				continue;
			const other = this.release.geometry(otherCode);
			if (!other) continue;
			const shared = sharedBorderWith(target, other);
			if (shared) neighbours.push({ code: otherCode, ...shared });
		}
		return neighbours.sort(
			(left, right) =>
				right.sharedBorderM - left.sharedBorderM ||
				left.code.localeCompare(right.code),
		);
	}
}
