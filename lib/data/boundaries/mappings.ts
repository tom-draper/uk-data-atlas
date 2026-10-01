import type { BoundaryType } from "./boundaries";

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
