import { GEOGRAPHIES } from "@/lib/docs/content/geographies";

export interface AreaEntry {
	label: string;
	boundaryType: string;
	year: number;
	matchType:
		"code" | "name" | "postcode-full" | "postcode-district" | "coordinate";
	codes: Set<string>;
	/** Lowercase name → every area of that name; more than one is ambiguous. */
	nameToCodes: Map<string, string[]>;
	/**
	 * Parent codes (a ward's local authorities) for the areas behind a shared
	 * name, so a parent column in the upload can tell them apart.
	 */
	parentsOf?: Map<string, string[]>;
	/** What the parents are, for the upload form, e.g. "Local authority". */
	parentLabel?: string;
	/** Lowercased parent name → its codes in any vintage. */
	parentNameToCodes?: Map<string, string[]>;
}

export interface AreaMatch {
	entry: AreaEntry;
	percentage: number;
	matchCount: number;
}

export type AreaBank = AreaEntry[];

const FULL_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i;
const DISTRICT_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/i;

// Precomputed match index (lib/data/gazetteer/matchIndex.ts): per boundary
// level+vintage, codes and a lowercased name -> codes map. Names are not
// unique (dozens of wards are called "Castle"), so every code is kept, with
// the parents that disambiguate them where the geography has any.
export type MatchIndex = Record<
	string,
	Record<
		number,
		{
			codes: string[];
			names: Record<string, string[]>;
			parents?: Record<string, string[]>;
		}
	>
>;

/**
 * One geography as it is shipped. Most codes and names survive unchanged
 * across vintages, so each is stored once with a bit mask of the vintages it
 * appears in (bit i is `years[i]`) rather than repeated in every year's list.
 */
export type CompactMatchIndexLevel = {
	years: number[];
	codes: Record<string, number>;
	names: [name: string, code: string, mask: number][];
	/** Every parent code seen for a code, across the level's vintages. */
	parents?: Record<string, string[]>;
};

export function compactMatchIndexLevel(
	level: MatchIndex[string],
): CompactMatchIndexLevel {
	const years = Object.keys(level)
		.map(Number)
		.sort((a, b) => a - b);
	if (years.length > 31)
		throw new Error("Too many vintages for a match index mask.");

	const codes: Record<string, number> = {};
	const names = new Map<string, [string, string, number]>();
	const parents: Record<string, string[]> = {};
	years.forEach((year, i) => {
		for (const [code, codeParents] of Object.entries(
			level[year].parents ?? {},
		))
			for (const parent of codeParents)
				if (!(parents[code] ??= []).includes(parent))
					parents[code].push(parent);
		const bit = 1 << i;
		for (const code of level[year].codes)
			codes[code] = (codes[code] ?? 0) | bit;
		for (const [name, nameCodes] of Object.entries(level[year].names))
			for (const code of nameCodes) {
				const key = `${name}\u0000${code}`;
				const entry = names.get(key);
				if (entry) entry[2] |= bit;
				else names.set(key, [name, code, bit]);
			}
	});
	return {
		years,
		codes,
		names: [...names.values()],
		...(Object.keys(parents).length > 0 && { parents }),
	};
}

/** Parse one geography from the downloaded match index into per-year data. */
export function parseMatchIndexLevel(value: unknown): MatchIndex[string] {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error("Invalid gazetteer match index level.");

	const { years, codes, names, parents } =
		value as Partial<CompactMatchIndexLevel>;
	if (
		!Array.isArray(years) ||
		years.length > 31 ||
		!years.every(Number.isInteger) ||
		typeof codes !== "object" ||
		codes === null ||
		Array.isArray(codes) ||
		!Array.isArray(names) ||
		(parents !== undefined &&
			(typeof parents !== "object" ||
				parents === null ||
				Array.isArray(parents) ||
				!Object.values(parents).every(
					(codeParents) =>
						Array.isArray(codeParents) &&
						codeParents.every(
							(parent) => typeof parent === "string",
						),
				)))
	)
		throw new Error("Invalid gazetteer match index level.");

	const full = (1 << years.length) - 1;
	const validMask = (mask: unknown): mask is number =>
		Number.isInteger(mask) &&
		(mask as number) > 0 &&
		((mask as number) & ~full) === 0;

	const level: MatchIndex[string] = {};
	for (const year of years)
		level[year] = { codes: [], names: {}, ...(parents && { parents }) };
	const eachYear = (mask: number, visit: (year: number) => void) =>
		years.forEach((year, i) => {
			if (mask & (1 << i)) visit(year);
		});

	for (const [code, mask] of Object.entries(codes)) {
		if (!validMask(mask))
			throw new Error("Invalid gazetteer match index codes.");
		eachYear(mask, (year) => level[year].codes.push(code));
	}
	for (const entry of names) {
		if (
			!Array.isArray(entry) ||
			typeof entry[0] !== "string" ||
			typeof entry[1] !== "string" ||
			!validMask(entry[2])
		)
			throw new Error("Invalid gazetteer match index names.");
		const [name, code, mask] = entry;
		eachYear(mask, (year) => (level[year].names[name] ??= []).push(code));
	}
	return level;
}

/** One area of a geography, as the docs name it: "Parish", "Local authority". */
const singularOf = (boundaryType: string) =>
	GEOGRAPHIES[boundaryType]?.singular ?? boundaryType;

/** The geography a level's parents belong to, where it has parents. */
const PARENT_LEVELS: Record<string, { level: string; label: string }> = {
	ward: { level: "localAuthority", label: singularOf("localAuthority") },
	parish: { level: "localAuthority", label: singularOf("localAuthority") },
};

/** Every name a level has had, across vintages, with every code it named. */
const namesAcrossVintages = (byYear: MatchIndex[string]) => {
	const merged = new Map<string, string[]>();
	for (const { names } of Object.values(byYear))
		for (const [name, codes] of Object.entries(names)) {
			const known = merged.get(name) ?? [];
			merged.set(name, [
				...known,
				...codes.filter((code) => !known.includes(code)),
			]);
		}
	return merged;
};

// Builds the same AreaBank buildAreaBank derives from geometry, but from the
// precomputed match index. Lets upload matching run against every geography
// without loading boundary geometry at runtime.
export function buildAreaBankFromIndex(index: MatchIndex): AreaBank {
	const bank: AreaBank = [];
	const parentNameCache = new Map<string, Map<string, string[]>>();
	const parentNames = (boundaryType: string) => {
		const parent = PARENT_LEVELS[boundaryType];
		const parentIndex = parent && index[parent.level];
		if (!parent || !parentIndex) return {};
		let names = parentNameCache.get(parent.level);
		if (!names) {
			names = namesAcrossVintages(parentIndex);
			parentNameCache.set(parent.level, names);
		}
		return { parentLabel: parent.label, parentNameToCodes: names };
	};
	for (const [boundaryType, byYear] of Object.entries(index)) {
		const label = singularOf(boundaryType);
		for (const [yearStr, { codes, names, parents }] of Object.entries(
			byYear,
		)) {
			const year = Number(yearStr);
			if (codes.length > 0) {
				bank.push({
					label: `${label} [${year}]`,
					boundaryType,
					year,
					matchType: "code",
					codes: new Set(codes),
					nameToCodes: new Map(),
				});
			}
			const nameEntries = Object.entries(names);
			if (nameEntries.length > 0) {
				bank.push({
					label: `${label} name [${year}]`,
					boundaryType,
					year,
					matchType: "name",
					codes: new Set(),
					nameToCodes: new Map(nameEntries),
					...(parents && {
						parentsOf: new Map(Object.entries(parents)),
						...parentNames(boundaryType),
					}),
				});
			}
		}
	}
	return bank;
}

export interface CoordinateColumns {
	latIdx: number;
	lngIdx: number;
}

interface NumericColumn {
	idx: number;
	min: number;
	max: number;
	ratio: number;
	hasDecimal: boolean;
	header: string;
}

// Scans a parsed table for a latitude/longitude column pair to plot as points.
// Returns a best-guess pairing (the upload UI lets the user override). Header
// names take priority; otherwise falls back to coordinate ranges and CSV order.
export function detectCoordinateColumns(
	table: string[][],
	headerRow: number,
): CoordinateColumns | null {
	const headers = table[headerRow] ?? [];
	const body = table.slice(headerRow + 1);
	if (body.length === 0) return null;

	const ncols = Math.max(
		headers.length,
		...body.slice(0, 50).map((r) => r.length),
	);
	const cols: NumericColumn[] = [];

	for (let c = 0; c < ncols; c++) {
		let numeric = 0;
		let total = 0;
		let min = Infinity;
		let max = -Infinity;
		let hasDecimal = false;
		for (const row of body.slice(0, 500)) {
			const raw = (row[c] ?? "").trim();
			if (raw === "") continue;
			total++;
			const n = Number(raw);
			if (!isNaN(n)) {
				numeric++;
				if (n < min) min = n;
				if (n > max) max = n;
				if (raw.includes(".")) hasDecimal = true;
			}
		}
		if (total === 0) continue;
		cols.push({
			idx: c,
			min,
			max,
			ratio: numeric / total,
			hasDecimal,
			header: (headers[c] ?? "").toLowerCase(),
		});
	}

	const valid = cols.filter(
		(c) =>
			c.ratio >= 0.8 &&
			c.hasDecimal &&
			isFinite(c.min) &&
			isFinite(c.max) &&
			c.min >= -180 &&
			c.max <= 180,
	);
	if (valid.length < 2) return null;

	const latByHeader = valid.find((c) => /lat/.test(c.header));
	const lngByHeader = valid.find((c) => /lon|lng/.test(c.header));
	if (latByHeader && lngByHeader && latByHeader.idx !== lngByHeader.idx) {
		return { latIdx: latByHeader.idx, lngIdx: lngByHeader.idx };
	}

	const latCandidates = valid.filter((c) => c.min >= -90 && c.max <= 90);
	if (latByHeader) {
		const lng = valid.find((c) => c.idx !== latByHeader.idx);
		if (lng) return { latIdx: latByHeader.idx, lngIdx: lng.idx };
	}
	if (lngByHeader) {
		const lat = latCandidates.find((c) => c.idx !== lngByHeader.idx);
		if (lat) return { latIdx: lat.idx, lngIdx: lngByHeader.idx };
	}

	// No header hints: a longitude column whose range exceeds ±90 is unambiguous.
	const lngWide = valid.find((c) => c.min < -90 || c.max > 90);
	if (lngWide) {
		const lat = latCandidates.find((c) => c.idx !== lngWide.idx);
		if (lat) return { latIdx: lat.idx, lngIdx: lngWide.idx };
	}

	// Fallback: assume conventional CSV order of latitude then longitude.
	if (latCandidates.length >= 2) {
		return { latIdx: latCandidates[0].idx, lngIdx: latCandidates[1].idx };
	}
	return null;
}

export function matchColumnAgainstBank(
	columnData: string[],
	areaBank: AreaBank,
): AreaMatch[] {
	if (columnData.length === 0 || areaBank.length === 0) return [];

	const sample = columnData
		.slice(0, 500)
		.map((v) => v.trim())
		.filter(Boolean);
	if (sample.length === 0) return [];

	const sampleSet = new Set(sample);
	const results: AreaMatch[] = [];

	for (const entry of areaBank) {
		let matchCount = 0;
		if (entry.matchType === "code") {
			matchCount = [...sampleSet].filter((v) =>
				entry.codes.has(v),
			).length;
		} else if (entry.matchType === "name") {
			matchCount = [...sampleSet].filter((v) =>
				entry.nameToCodes.has(v.toLowerCase()),
			).length;
		}
		if (matchCount > 0) {
			results.push({
				entry,
				percentage: (matchCount / sampleSet.size) * 100,
				matchCount,
			});
		}
	}

	// Full postcodes take priority over district codes
	const fullPostcodes = [...sampleSet].filter((v) =>
		FULL_POSTCODE_RE.test(v),
	);
	if (fullPostcodes.length > 0) {
		results.push({
			entry: {
				label: "Postcode",
				boundaryType: "postcode",
				year: 0,
				matchType: "postcode-full",
				codes: new Set(
					fullPostcodes.map((v) =>
						v.replace(/\s+/, " ").toUpperCase(),
					),
				),
				nameToCodes: new Map(),
			},
			percentage: (fullPostcodes.length / sampleSet.size) * 100,
			matchCount: fullPostcodes.length,
		});
	} else {
		const districts = [...sampleSet].filter((v) => DISTRICT_RE.test(v));
		if (districts.length > 0) {
			results.push({
				entry: {
					label: "Postcode District",
					boundaryType: "postcode",
					year: 0,
					matchType: "postcode-district",
					codes: new Set(districts.map((v) => v.toUpperCase())),
					nameToCodes: new Map(),
				},
				percentage: (districts.length / sampleSet.size) * 100,
				matchCount: districts.length,
			});
		}
	}

	// Coordinate detection: all unique values must be decimal numbers in coordinate range
	const nums = [...sampleSet].map((v) => parseFloat(v));
	if (
		nums.every((n) => !isNaN(n)) &&
		[...sampleSet].some((v) => v.includes("."))
	) {
		const min = Math.min(...nums);
		const max = Math.max(...nums);
		if (min >= -90 && max <= 90) {
			results.push({
				entry: {
					label: "Latitude",
					boundaryType: "coordinate",
					year: 0,
					matchType: "coordinate",
					codes: new Set(),
					nameToCodes: new Map(),
				},
				percentage: 100,
				matchCount: sampleSet.size,
			});
		} else if (min >= -180 && max <= 180) {
			results.push({
				entry: {
					label: "Longitude",
					boundaryType: "coordinate",
					year: 0,
					matchType: "coordinate",
					codes: new Set(),
					nameToCodes: new Map(),
				},
				percentage: 100,
				matchCount: sampleSet.size,
			});
		}
	}

	// Unchanged codes and names match every vintage equally; on a tie the
	// newest is the likeliest reading of a file someone uploads today.
	return results.sort(
		(a, b) => b.percentage - a.percentage || b.entry.year - a.entry.year,
	);
}
