import type { BoundaryGeojson, Features } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { getProp } from "./properties";
import { BOUNDARY_CATALOG } from "./catalog";
import { outerRings } from "@lib/types";

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
	version: 2;
	wardToLad: Record<string, string>;
	ladToWards: YearMasked<"members">;
	codeMappings: Record<
		keyof PrecompiledBoundaryMappings["codeMappings"],
		YearMasked<"targets">
	>;
	constituencyToWards: Record<number, Record<string, string[]>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
	isRecord(value) &&
	Object.values(value).every((entry) => typeof entry === "string");

const isStringArrayRecord = (
	value: unknown,
): value is Record<string, string[]> =>
	isRecord(value) &&
	Object.values(value).every(
		(entry) =>
			Array.isArray(entry) &&
			entry.every((item) => typeof item === "string"),
	);

const isYearStringArrayRecord = (
	value: unknown,
): value is Record<number, Record<string, string[]>> =>
	isRecord(value) &&
	Object.entries(value).every(
		([year, records]) =>
			Number.isInteger(Number(year)) && isStringArrayRecord(records),
	);

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
	const ladToWards = maskYears(mappings.ladToWards);
	return {
		version: 2,
		wardToLad: mappings.wardToLad,
		ladToWards: { years: ladToWards.years, members: ladToWards.masked },
		codeMappings: {
			ward: encodeCodeMapping(mappings.codeMappings.ward),
			constituency: encodeCodeMapping(mappings.codeMappings.constituency),
			localAuthority: encodeCodeMapping(
				mappings.codeMappings.localAuthority,
			),
		},
		constituencyToWards: mappings.constituencyToWards,
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
		value.version !== 2 ||
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
		value.version !== 2 ||
		!isStringRecord(value.wardToLad) ||
		!isRecord(value.ladToWards) ||
		!isRecord(value.codeMappings) ||
		!isYearStringArrayRecord(value.constituencyToWards)
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
		constituencyToWards: value.constituencyToWards,
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

function pointInPolygon(px: number, py: number, ring: number[][]): boolean {
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

export const buildConstituencyWardMappings = (
	wardGeoJSON: BoundaryGeojson,
	constituencyGeoJSON: BoundaryGeojson,
): Record<string, string[]> => {
	interface Constituency {
		code: string;
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		rings: number[][][];
	}

	const constituencies: Constituency[] = [];
	for (const feature of constituencyGeoJSON.features) {
		const code = getProp(
			feature.properties,
			BOUNDARY_CATALOG.constituency.properties.code,
		);
		if (!code) continue;

		// A vintage held as properties alone cannot be matched by shape; the
		// precompiled mappings cover that case, this fallback needs geometry.
		if (!feature.geometry) continue;
		const rings = outerRings(feature.geometry);
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const ring of rings) {
			for (const [x, y] of ring) {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		constituencies.push({ code, minX, minY, maxX, maxY, rings });
	}

	const mappings: Record<string, string[]> = {};
	for (const feature of wardGeoJSON.features) {
		const wardCode = getProp(
			feature.properties,
			BOUNDARY_CATALOG.ward.properties.code,
		);
		if (!wardCode) continue;

		if (!feature.geometry) continue;
		// Only the first part is needed: this is a rough centroid for labelling.
		const [ring] = outerRings(feature.geometry);
		if (!ring) continue;
		let cx = 0;
		let cy = 0;
		for (const [x, y] of ring) {
			cx += x;
			cy += y;
		}
		cx /= ring.length;
		cy /= ring.length;

		for (const constituency of constituencies) {
			if (
				cx < constituency.minX ||
				cx > constituency.maxX ||
				cy < constituency.minY ||
				cy > constituency.maxY
			)
				continue;
			if (
				!constituency.rings.some((candidate) =>
					pointInPolygon(cx, cy, candidate),
				)
			)
				continue;
			(mappings[constituency.code] ??= []).push(wardCode);
			break;
		}
	}

	return mappings;
};
