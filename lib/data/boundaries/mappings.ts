import type { BoundaryGeojson, BoundaryGeometry, Features } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { getProp } from "./properties";
import { BOUNDARY_CATALOG } from "./catalog";

export type CodeType = BoundaryType;
export type YearCode = number;

export interface CodeMapping {
	[fromCode: string]: {
		[toYear: number]: string;
	};
}

export interface PrecompiledBoundaryMappings {
	wardToLad: Record<string, string>;
	ladToWards: Record<number, Record<string, string[]>>;
	codeMappings: Pick<
		Record<CodeType, CodeMapping>,
		"ward" | "localAuthority" | "constituency"
	>;
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

/** The file `boundary-mappings.json` holds. */
export interface BoundaryMappingsFile {
	version: 3;
	wardToLad: Record<string, string>;
	ladToWards: YearMasked<"members">;
	codeMappings: Record<
		keyof PrecompiledBoundaryMappings["codeMappings"],
		YearMasked<"targets">
	>;
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

// A code with no counterpart in any other year has nothing to store, so it is
// absent after a round trip rather than an empty entry; every reader of a
// CodeMapping already treats the two alike.
const encodeCodeMapping = (mapping: CodeMapping): YearMasked<"targets"> => {
	const byYear: Record<number, Record<string, string[]>> = {};
	for (const [fromCode, targets] of Object.entries(mapping))
		for (const [year, toCode] of Object.entries(targets))
			(byYear[Number(year)] ??= {})[fromCode] = [toCode];
	const { years, masked } = maskYears(byYear);
	return { years, targets: masked };
};

const decodeCodeMapping = (value: unknown): CodeMapping => {
	if (!isRecord(value)) throw invalid();
	const mapping: CodeMapping = {};
	for (const [year, codes] of Object.entries(
		unmaskYears(value.years, value.targets),
	))
		for (const [fromCode, toCodes] of Object.entries(codes)) {
			// One code maps to one code per year; a second is a corrupt file.
			if (toCodes.length !== 1) throw invalid();
			(mapping[fromCode] ??= {})[Number(year)] = toCodes[0];
		}
	return mapping;
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
		version: 3,
		wardToLad: mappings.wardToLad,
		ladToWards: maskedMembers(mappings.ladToWards),
		codeMappings: {
			ward: encodeCodeMapping(mappings.codeMappings.ward),
			constituency: encodeCodeMapping(mappings.codeMappings.constituency),
			localAuthority: encodeCodeMapping(
				mappings.codeMappings.localAuthority,
			),
		},
		constituencyToWards: maskedMembers(mappings.constituencyToWards),
	};
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
		value.version !== 3 ||
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
		value.version !== 3 ||
		!isStringRecord(value.wardToLad) ||
		!isRecord(value.ladToWards) ||
		!isRecord(value.codeMappings) ||
		!isRecord(value.constituencyToWards)
	)
		throw invalid();
	return {
		wardToLad: value.wardToLad,
		ladToWards: unmaskYears(
			value.ladToWards.years,
			value.ladToWards.members,
		),
		codeMappings: {
			ward: decodeCodeMapping(value.codeMappings.ward),
			constituency: decodeCodeMapping(value.codeMappings.constituency),
			localAuthority: decodeCodeMapping(
				value.codeMappings.localAuthority,
			),
		},
		constituencyToWards: unmaskYears(
			value.constituencyToWards.years,
			value.constituencyToWards.members,
		),
	};
};

export const extractWardLadMappings = (
	features: Features,
	wardCodeKeys: readonly string[],
	localAuthorityCodeKeys: readonly string[],
): {
	wardToLad: Record<string, string>;
	ladToWards: Record<string, string[]>;
} => {
	const wardToLad: Record<string, string> = {};
	const ladToWardSets: Record<string, Set<string>> = {};

	for (const feature of features) {
		const props = feature.properties;
		if (!props) continue;

		const wardCode = getProp(props, wardCodeKeys);
		const localAuthorityCode = getProp(props, localAuthorityCodeKeys);

		if (wardCode && localAuthorityCode) {
			wardToLad[wardCode] = localAuthorityCode;
			if (!ladToWardSets[localAuthorityCode]) {
				ladToWardSets[localAuthorityCode] = new Set();
			}
			ladToWardSets[localAuthorityCode].add(wardCode);
		}
	}

	return {
		wardToLad,
		ladToWards: Object.fromEntries(
			Object.entries(ladToWardSets).map(([code, wards]) => [
				code,
				[...wards],
			]),
		),
	};
};

export const buildCrossYearMappings = (
	boundaryData: Record<number, BoundaryGeojson>,
	type: Extract<CodeType, "ward" | "constituency" | "localAuthority">,
	years: number[],
): CodeMapping => {
	const mappings: CodeMapping = {};
	const codeKeys =
		type === "ward"
			? BOUNDARY_CATALOG.ward.properties.code
			: type === "constituency"
				? BOUNDARY_CATALOG.constituency.properties.code
				: BOUNDARY_CATALOG.localAuthority.properties.code;
	const nameKeys =
		type === "ward"
			? BOUNDARY_CATALOG.ward.properties.name
			: type === "constituency"
				? BOUNDARY_CATALOG.constituency.properties.name
				: BOUNDARY_CATALOG.localAuthority.properties.name;
	const nameIndex: Record<string, Set<{ code: string; year: number }>> = {};

	for (const year of years) {
		const geojson = boundaryData[year];
		if (!geojson?.features) continue;

		for (const feature of geojson.features) {
			const props = feature.properties;
			if (!props) continue;

			const code = getProp(props, codeKeys);
			const name = getProp(props, nameKeys);
			if (!code || !name) continue;

			const ladCode =
				type === "ward"
					? getProp(
							props,
							BOUNDARY_CATALOG.localAuthority.properties.code,
						)
					: null;
			// The Dec 2017 constituencies are published as "St. Albans" where
			// every other release says "St Albans", and names are all these
			// mappings have to match on, so drop abbreviation stops before
			// comparing. Only for constituencies: ward names are only
			// qualified by a local authority when the release publishes one,
			// and without that qualifier dropping stops merges same-named
			// wards in different countries.
			const plainName =
				type === "constituency"
					? name.toLowerCase().replace(/\./g, "").trim()
					: name.toLowerCase().trim();
			const normalizedName = ladCode
				? `${plainName}|${ladCode}`
				: plainName;
			(nameIndex[normalizedName] ??= new Set()).add({ code, year });
		}
	}

	for (const codeSet of Object.values(nameIndex)) {
		const codes = [...codeSet];
		for (const { code: fromCode, year: fromYear } of codes) {
			const targets = (mappings[fromCode] ??= {});
			for (const { code: toCode, year: toYear } of codes) {
				if (fromYear !== toYear) targets[toYear] = toCode;
			}
		}
	}

	return mappings;
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

/** Samples per side of the grid laid over each ward. */
const MEMBERSHIP_GRID = 8;

/**
 * Which wards each constituency holds, best fit: every ward goes to the one
 * constituency holding most of it, estimated by sampling an 8x8 grid over the
 * ward. A ward straddling a boundary is counted once, never twice, so ward
 * values sum to constituency totals. Against the ONS ward/constituency
 * lookups this agrees on 99.94% (2025 wards, 2024 constituencies) and 99.99%
 * (2022, 2010 set) of wards the lookup places in a single constituency.
 */
export const buildConstituencyWardMappings = (
	wardGeoJSON: BoundaryGeojson,
	constituencyGeoJSON: BoundaryGeojson,
): Record<string, string[]> => {
	const constituencies = constituencyGeoJSON.features.flatMap((feature) => {
		const code = getProp(
			feature.properties,
			BOUNDARY_CATALOG.constituency.properties.code,
		);
		// A vintage held as properties alone cannot be matched by shape; the
		// precompiled mappings cover that case, this needs geometry.
		if (!code || !feature.geometry) return [];
		const polygons = polygonsOf(feature.geometry);
		return [{ code, polygons, bbox: bboxOf(polygons) }];
	});
	const constituencyAt = (x: number, y: number) =>
		constituencies.find(
			({ polygons, bbox }) =>
				inBbox(x, y, bbox) && inPolygons(x, y, polygons),
		)?.code;

	const mappings: Record<string, string[]> = {};
	for (const feature of wardGeoJSON.features) {
		const wardCode = getProp(
			feature.properties,
			BOUNDARY_CATALOG.ward.properties.code,
		);
		if (!wardCode || !feature.geometry) continue;
		const polygons = polygonsOf(feature.geometry);
		const [x0, y0, x1, y1] = bboxOf(polygons);

		const votes = new Map<string, number>();
		for (let i = 0; i < MEMBERSHIP_GRID; i++)
			for (let j = 0; j < MEMBERSHIP_GRID; j++) {
				const x = x0 + ((i + 0.5) / MEMBERSHIP_GRID) * (x1 - x0);
				const y = y0 + ((j + 0.5) / MEMBERSHIP_GRID) * (y1 - y0);
				if (!inPolygons(x, y, polygons)) continue;
				const code = constituencyAt(x, y);
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
					if ((best = constituencyAt(x, y))) break;
				if (best) break;
			}
		if (best) (mappings[best] ??= []).push(wardCode);
	}

	return mappings;
};
