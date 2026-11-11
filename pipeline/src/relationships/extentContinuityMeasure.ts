import type { MultiPolygon } from "polygon-clipping";
import type { BoundedClipper } from "@uk-data-atlas/geometry";
import {
	type AreaGeometry,
	areaMultiPolygon,
	areaBoundsIntersect as boundsIntersect,
	roundedMultiPolygon,
} from "@uk-data-atlas/geography";
import { round } from "../geographies/areaOverlap.ts";
import { multiPolygonAreaM2, polygonWidthM } from "@uk-data-atlas/map-tiles";

// About a millimetre. Rounding only feeds a retry, when polygon-clipping's
// sweep line fails on near-coincident edges.
const RETRY_PRECISION = 1e8;

/**
 * One clip, retried at a millimetre's precision if polygon-clipping's sweep
 * line fails on near-coincident edges, or why it could not be made.
 */
const clipRetried = (
	clipper: BoundedClipper,
	operation: "difference" | "intersection",
	first: MultiPolygon,
	second: MultiPolygon,
): { geometry: MultiPolygon } | { reason: string } => {
	const attempt = clipper.clip(operation, first, second);
	if (attempt.status === "clipped") return { geometry: attempt.geometry };
	const retry = clipper.clip(
		operation,
		roundedMultiPolygon(first, RETRY_PRECISION),
		roundedMultiPolygon(second, RETRY_PRECISION),
	);
	return retry.status === "clipped"
		? { geometry: retry.geometry }
		: {
				reason: `${attempt.reason} Retried at 1e-8 degrees: ${retry.reason}`,
			};
};

/**
 * Where two releases of one code disagree: the symmetric difference of the
 * whole multipolygons, retried at a millimetre's precision if the clipper
 * fails, or why it could not be measured.
 */
const difference = (
	clipper: BoundedClipper,
	source: AreaGeometry,
	target: AreaGeometry,
): { geometry: MultiPolygon } | { reason: string } => {
	const first = clipper.clip(
		"xor",
		areaMultiPolygon(source),
		areaMultiPolygon(target),
	);
	if (first.status === "clipped") return { geometry: first.geometry };
	const retry = clipper.clip(
		"xor",
		areaMultiPolygon(source, RETRY_PRECISION),
		areaMultiPolygon(target, RETRY_PRECISION),
	);
	return retry.status === "clipped"
		? { geometry: retry.geometry }
		: {
				reason: `${first.reason} Retried at 1e-8 degrees: ${retry.reason}`,
			};
};

export type Measured = {
	widestDifferenceM: number;
	sourceShare: number;
	targetShare: number;
};

/**
 * The widest piece of two geometries' difference, and the share of each
 * their overlap covers, or why the clipper could not measure them.
 */
export const measure = (
	clipper: BoundedClipper,
	source: AreaGeometry,
	target: AreaGeometry,
): Measured | { reason: string } => {
	const measured = difference(clipper, source, target);
	if ("reason" in measured) return measured;
	// The overlap is what the difference leaves of the two areas.
	const overlapAreaM2 = Math.max(
		0,
		(source.areaM2 +
			target.areaM2 -
			multiPolygonAreaM2(measured.geometry)) /
			2,
	);
	return {
		widestDifferenceM: round(
			Math.max(0, ...measured.geometry.map(polygonWidthM)),
			1,
		),
		sourceShare: round(Math.min(1, overlapAreaM2 / source.areaM2), 6),
		targetShare: round(Math.min(1, overlapAreaM2 / target.areaM2), 6),
	};
};

/**
 * The widest piece of `difference` another area of the other release holds:
 * land that changed hands. The rest belongs to no area there, such as coast
 * or estuary one release's generalised outline includes and the other's
 * leaves out, and moves no boundary between areas.
 */
const claimedWidthM = (
	clipper: BoundedClipper,
	difference: MultiPolygon,
	bounds: AreaGeometry["bounds"],
	others: Array<[string, AreaGeometry]>,
): number | { reason: string } => {
	let widest = 0;
	for (const [, other] of others) {
		if (!boundsIntersect(bounds, other.bounds)) continue;
		const claimed = clipRetried(
			clipper,
			"intersection",
			difference,
			areaMultiPolygon(other),
		);
		if ("reason" in claimed) return claimed;
		widest = Math.max(widest, ...claimed.geometry.map(polygonWidthM));
	}
	return round(widest, 1);
};

/**
 * The widest piece of a shared code's difference that another area claims,
 * in either direction, or why it could not be measured.
 */
export const claimedDifference = (
	clipper: BoundedClipper,
	code: string,
	source: AreaGeometry,
	target: AreaGeometry,
	sources: Array<[string, AreaGeometry]>,
	targets: Array<[string, AreaGeometry]>,
): number | { reason: string } => {
	const lost = clipRetried(
		clipper,
		"difference",
		areaMultiPolygon(source),
		areaMultiPolygon(target),
	);
	if ("reason" in lost) return lost;
	const gained = clipRetried(
		clipper,
		"difference",
		areaMultiPolygon(target),
		areaMultiPolygon(source),
	);
	if ("reason" in gained) return gained;
	const others = (areas: Array<[string, AreaGeometry]>) =>
		areas.filter(([other]) => other !== code);
	const toNeighbours = claimedWidthM(
		clipper,
		lost.geometry,
		source.bounds,
		others(targets),
	);
	if (typeof toNeighbours !== "number") return toNeighbours;
	const fromNeighbours = claimedWidthM(
		clipper,
		gained.geometry,
		target.bounds,
		others(sources),
	);
	if (typeof fromNeighbours !== "number") return fromNeighbours;
	return Math.max(toNeighbours, fromNeighbours);
};
