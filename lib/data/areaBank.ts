export interface AreaEntry {
	label: string;
	boundaryType: string;
	year: number;
	matchType:
		"code" | "name" | "postcode-full" | "postcode-district" | "coordinate";
	codes: Set<string>;
	nameToCode: Map<string, string>; // lowercase name → boundary code
}

export interface AreaMatch {
	entry: AreaEntry;
	percentage: number;
	matchCount: number;
}

export type AreaBank = AreaEntry[];

const FULL_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i;
const DISTRICT_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/i;

// Precomputed match index (scripts/gazetteer-matchindex.ts): per boundary
// level+vintage, codes and a lowercased name->code map.
export type MatchIndex = Record<
	string,
	Record<number, { codes: string[]; names: Record<string, string> }>
>;

const LEVEL_LABELS: Record<string, string> = {
	ward: "Ward",
	constituency: "Constituency",
	localAuthority: "Local Authority",
	lsoa: "LSOA",
	dataZone: "Data Zone",
	superOutputArea: "Super Output Area",
};

// Builds the same AreaBank buildAreaBank derives from geometry, but from the
// precomputed match index. Lets upload matching run against every geography
// without loading boundary geometry at runtime.
export function buildAreaBankFromIndex(index: MatchIndex): AreaBank {
	const bank: AreaBank = [];
	for (const [boundaryType, byYear] of Object.entries(index)) {
		const label = LEVEL_LABELS[boundaryType] ?? boundaryType;
		for (const [yearStr, { codes, names }] of Object.entries(byYear)) {
			const year = Number(yearStr);
			if (codes.length > 0) {
				bank.push({
					label: `${label} [${year}]`,
					boundaryType,
					year,
					matchType: "code",
					codes: new Set(codes),
					nameToCode: new Map(),
				});
			}
			const nameEntries = Object.entries(names);
			if (nameEntries.length > 0) {
				bank.push({
					label: `${label} Name [${year}]`,
					boundaryType,
					year,
					matchType: "name",
					codes: new Set(),
					nameToCode: new Map(nameEntries),
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
				entry.nameToCode.has(v.toLowerCase()),
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
				nameToCode: new Map(),
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
					nameToCode: new Map(),
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
					nameToCode: new Map(),
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
					nameToCode: new Map(),
				},
				percentage: 100,
				matchCount: sampleSet.size,
			});
		}
	}

	return results.sort((a, b) => b.percentage - a.percentage);
}
