import type { BoundaryGeojson, BoundaryGeometry } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { getProp } from "./properties";

export type CodeType = BoundaryType;
export type YearCode = number;

export interface PrecompiledBoundaryMappings {
	wardToLad: Record<string, string>;
	ladToWards: Record<number, Record<string, string[]>>;
	constituencyToWards: Record<number, Record<string, string[]>>;
}

/**
 * A year-keyed lookup as it is shipped. Most codes keep the same target in
 * every year, so each (key, value) pair is stored once with a bit mask of the
 * years it holds in (bit i is `years[i]`) instead of being repeated per year.
 */
type YearMasked<K extends string> = {
	years: number[];
} & Record<K, Record<string, Record<string, number>>>;

/**
 * The file `boundary-mappings.json` holds. Version 4 dropped the name-matched
 * code mappings between years: the area lineage the API's geography resolver
 * writes (`area-lineage.json`) carries areas across years instead.
 */
export interface BoundaryMappingsFile {
	version: 4;
	wardToLad: Record<string, string>;
	ladToWards: YearMasked<"members">;
	constituencyToWards: YearMasked<"members">;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
	isRecord(value) &&
	Object.values(value).every((entry) => typeof entry === "string");

const MAX_MASKED_YEARS = 31;

const invalid = () => new Error("Invalid precompiled boundary mappings.");

/** Fold per-year `key -> value[]` pairs into `key -> value -> year mask`. */
const maskYears = (
	byYear: Record<number, Record<string, string[]>>,
): { years: number[]; masked: Record<string, Record<string, number>> } => {
	const years = Object.keys(byYear)
		.map(Number)
		.sort((a, b) => a - b);
	if (years.length > MAX_MASKED_YEARS)
		throw new Error("Too many years for a boundary mapping mask.");
	const masked: Record<string, Record<string, number>> = {};
	years.forEach((year, i) => {
		for (const [key, values] of Object.entries(byYear[year]))
			for (const value of values) {
				const entry = (masked[key] ??= {});
				entry[value] = (entry[value] ?? 0) | (1 << i);
			}
	});
	return { years, masked };
};

/** Expand `key -> value -> year mask` back into per-year `key -> value[]`. */
const unmaskYears = (
	years: unknown,
	masked: unknown,
): Record<number, Record<string, string[]>> => {
	if (
		!Array.isArray(years) ||
		years.length > MAX_MASKED_YEARS ||
		!years.every(Number.isInteger) ||
		!isRecord(masked)
	)
		throw invalid();
	const full = (1 << years.length) - 1;
	const byYear: Record<number, Record<string, string[]>> = {};
	for (const year of years as number[]) byYear[year] = {};
	for (const [key, values] of Object.entries(masked)) {
		if (!isRecord(values)) throw invalid();
		for (const [value, mask] of Object.entries(values)) {
			if (
				typeof mask !== "number" ||
				!Number.isInteger(mask) ||
				mask <= 0 ||
				(mask & ~full) !== 0
			)
				throw invalid();
			(years as number[]).forEach((year, i) => {
				if (mask & (1 << i)) (byYear[year][key] ??= []).push(value);
			});
		}
	}
	return byYear;
};

export const encodeBoundaryMappings = (
	mappings: PrecompiledBoundaryMappings,
): BoundaryMappingsFile => {
	const maskedMembers = (
		byYear: Record<number, Record<string, string[]>>,
	): YearMasked<"members"> => {
		const { years, masked } = maskYears(byYear);
		return { years, members: masked };
	};
	return {
		version: 4,
		wardToLad: mappings.wardToLad,
		ladToWards: maskedMembers(mappings.ladToWards),
		constituencyToWards: maskedMembers(mappings.constituencyToWards),
	};
};

/**
 * The file `parish-lad-mappings.json` holds: each parish's local authority
 * in the release of its own era, for every served parish release. Only the
 * precompile reads it, to tell same-named parishes apart in upload matching.
 */
export interface ParishLadMappingsFile {
	version: 1;
	parishToLad: YearMasked<"parents">;
}

export const encodeParishLadMappings = (
	byYear: Record<number, Record<string, string>>,
): ParishLadMappingsFile => {
	const { years, masked } = maskYears(
		Object.fromEntries(
			Object.entries(byYear).map(([year, parents]) => [
				year,
				Object.fromEntries(
					Object.entries(parents).map(([code, lad]) => [code, [lad]]),
				),
			]),
		),
	);
	return { version: 1, parishToLad: { years, parents: masked } };
};

export const parseParishLadMappings = (
	value: unknown,
): Record<number, Record<string, string>> => {
	if (!isRecord(value) || value.version !== 1 || !isRecord(value.parishToLad))
		throw invalid();
	const byYear = unmaskYears(
		value.parishToLad.years,
		value.parishToLad.parents,
	);
	return Object.fromEntries(
		Object.entries(byYear).map(([year, parents]) => [
			year,
			Object.fromEntries(
				Object.entries(parents).map(([code, [lad]]) => [code, lad!]),
			),
		]),
	);
};

/**
 * Just the ward to local authority map, for a worker that filters wards by
 * location and has no use for expanding the rest of the file.
 */
export const parseBoundaryWardToLad = (
	value: unknown,
): Record<string, string> => {
	if (
		!isRecord(value) ||
		value.version !== 4 ||
		!isStringRecord(value.wardToLad)
	)
		throw invalid();
	return value.wardToLad;
};

export const parsePrecompiledBoundaryMappings = (
	value: unknown,
): PrecompiledBoundaryMappings => {
	if (
		!isRecord(value) ||
		value.version !== 4 ||
		!isStringRecord(value.wardToLad) ||
		!isRecord(value.ladToWards) ||
		!isRecord(value.constituencyToWards)
	)
		throw invalid();
	return {
		wardToLad: value.wardToLad,
		ladToWards: unmaskYears(
			value.ladToWards.years,
			value.ladToWards.members,
		),
		constituencyToWards: unmaskYears(
			value.constituencyToWards.years,
			value.constituencyToWards.members,
		),
	};
};

function pointInRing(px: number, py: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (
			yi > py !== yj > py &&
			px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
		) {
			inside = !inside;
		}
	}
	return inside;
}

/** Each part of a geometry as rings, outer first, holes after. */
const polygonsOf = (geometry: BoundaryGeometry): number[][][][] =>
	geometry.type === "MultiPolygon"
		? geometry.coordinates
		: [geometry.coordinates];

const inPolygons = (x: number, y: number, polygons: number[][][][]) =>
	polygons.some(
		([outer, ...holes]) =>
			pointInRing(x, y, outer) &&
			!holes.some((hole) => pointInRing(x, y, hole)),
	);

type Bbox = [number, number, number, number];

const bboxOf = (polygons: number[][][][]): Bbox => {
	const bbox: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [outer] of polygons)
		for (const [x, y] of outer) {
			bbox[0] = Math.min(bbox[0], x);
			bbox[1] = Math.min(bbox[1], y);
			bbox[2] = Math.max(bbox[2], x);
			bbox[3] = Math.max(bbox[3], y);
		}
	return bbox;
};

const inBbox = (x: number, y: number, [x0, y0, x1, y1]: Bbox) =>
	x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Samples per side of the grid laid over each area. */
const MEMBERSHIP_GRID = 8;

/**
 * Which container holds most of each area, estimated by sampling an 8x8 grid
 * over the area: a best fit, so an area straddling a boundary gets one
 * container, never two. Areas `include` rejects are skipped.
 */
export const bestFitContainer = (
	areas: BoundaryGeojson,
	areaCodeKeys: readonly string[],
	containers: BoundaryGeojson,
	containerCodeKeys: readonly string[],
	include: (areaCode: string) => boolean = () => true,
): Record<string, string> => {
	const indexed = containers.features.flatMap((feature) => {
		const code = getProp(feature.properties, containerCodeKeys);
		// A vintage held as properties alone cannot be matched by shape; the
		// precompiled mappings cover that case, this needs geometry.
		if (!code || !feature.geometry) return [];
		const polygons = polygonsOf(feature.geometry);
		return [{ code, polygons, bbox: bboxOf(polygons) }];
	});
	const containerAt = (x: number, y: number) =>
		indexed.find(
			({ polygons, bbox }) =>
				inBbox(x, y, bbox) && inPolygons(x, y, polygons),
		)?.code;

	const fits: Record<string, string> = {};
	for (const feature of areas.features) {
		const areaCode = getProp(feature.properties, areaCodeKeys);
		if (!areaCode || !feature.geometry || !include(areaCode)) continue;
		const polygons = polygonsOf(feature.geometry);
		const [x0, y0, x1, y1] = bboxOf(polygons);

		const votes = new Map<string, number>();
		for (let i = 0; i < MEMBERSHIP_GRID; i++)
			for (let j = 0; j < MEMBERSHIP_GRID; j++) {
				const x = x0 + ((i + 0.5) / MEMBERSHIP_GRID) * (x1 - x0);
				const y = y0 + ((j + 0.5) / MEMBERSHIP_GRID) * (y1 - y0);
				if (!inPolygons(x, y, polygons)) continue;
				const code = containerAt(x, y);
				if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
			}
		let best: string | undefined;
		let bestVotes = 0;
		for (const [code, count] of votes)
			if (count > bestVotes) [best, bestVotes] = [code, count];

		// A sliver no sample lands in falls back to where its outline sits.
		if (!best)
			for (const [outer] of polygons) {
				for (const [x, y] of outer)
					if ((best = containerAt(x, y))) break;
				if (best) break;
			}
		if (best) fits[areaCode] = best;
	}
	return fits;
};
