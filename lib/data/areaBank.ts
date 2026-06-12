import type { BoundaryData } from "@lib/types/boundaries";
import { PROPERTY_KEYS, getProp } from "@lib/data/boundaries/boundaries";

export interface AreaEntry {
	label: string;
	boundaryType: string;
	year: number;
	matchType: "code" | "name" | "postcode-full" | "postcode-district" | "coordinate";
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

const BOUNDARY_META = [
	{ key: "ward" as const, label: "Ward", codeKeys: PROPERTY_KEYS.wardCode, nameKeys: PROPERTY_KEYS.wardName },
	{ key: "constituency" as const, label: "Constituency", codeKeys: PROPERTY_KEYS.constituencyCode, nameKeys: PROPERTY_KEYS.constituencyName },
	{ key: "localAuthority" as const, label: "Local Authority", codeKeys: PROPERTY_KEYS.ladCode, nameKeys: PROPERTY_KEYS.ladName },
	{ key: "lsoa" as const, label: "LSOA", codeKeys: PROPERTY_KEYS.lsoaCode, nameKeys: PROPERTY_KEYS.lsoaName },
	{ key: "dataZone" as const, label: "Data Zone", codeKeys: PROPERTY_KEYS.dataZoneCode, nameKeys: PROPERTY_KEYS.dataZoneName },
	{ key: "superOutputArea" as const, label: "Super Output Area", codeKeys: PROPERTY_KEYS.soaCode, nameKeys: PROPERTY_KEYS.soaName },
];

export function buildAreaBank(boundaryData: BoundaryData): AreaBank {
	const bank: AreaBank = [];

	for (const meta of BOUNDARY_META) {
		const typeData = boundaryData[meta.key];
		for (const [yearStr, geojson] of Object.entries(typeData)) {
			if (!geojson?.features?.length) continue;
			const year = Number(yearStr);

			const codes = new Set<string>();
			const nameToCode = new Map<string, string>();

			for (const feature of geojson.features) {
				const props = feature.properties;
				if (!props) continue;
				const code = getProp(props, meta.codeKeys);
				const name = getProp(props, meta.nameKeys);
				if (code) codes.add(code);
				if (name && code) nameToCode.set(name.toLowerCase(), code);
			}

			if (codes.size > 0) {
				bank.push({
					label: `${meta.label} [${year}]`,
					boundaryType: meta.key,
					year,
					matchType: "code",
					codes,
					nameToCode: new Map(),
				});
			}
			if (nameToCode.size > 0) {
				bank.push({
					label: `${meta.label} Name [${year}]`,
					boundaryType: meta.key,
					year,
					matchType: "name",
					codes: new Set(),
					nameToCode,
				});
			}
		}
	}

	return bank;
}

export function matchColumnAgainstBank(columnData: string[], areaBank: AreaBank): AreaMatch[] {
	if (columnData.length === 0 || areaBank.length === 0) return [];

	const sample = columnData.slice(0, 500).map(v => v.trim()).filter(Boolean);
	if (sample.length === 0) return [];

	const sampleSet = new Set(sample);
	const results: AreaMatch[] = [];

	for (const entry of areaBank) {
		let matchCount = 0;
		if (entry.matchType === "code") {
			matchCount = [...sampleSet].filter(v => entry.codes.has(v)).length;
		} else if (entry.matchType === "name") {
			matchCount = [...sampleSet].filter(v => entry.nameToCode.has(v.toLowerCase())).length;
		}
		if (matchCount > 0) {
			results.push({ entry, percentage: (matchCount / sampleSet.size) * 100, matchCount });
		}
	}

	// Full postcodes take priority over district codes
	const fullPostcodes = [...sampleSet].filter(v => FULL_POSTCODE_RE.test(v));
	if (fullPostcodes.length > 0) {
		results.push({
			entry: {
				label: "Postcode",
				boundaryType: "postcode",
				year: 0,
				matchType: "postcode-full",
				codes: new Set(fullPostcodes.map(v => v.replace(/\s+/, " ").toUpperCase())),
				nameToCode: new Map(),
			},
			percentage: (fullPostcodes.length / sampleSet.size) * 100,
			matchCount: fullPostcodes.length,
		});
	} else {
		const districts = [...sampleSet].filter(v => DISTRICT_RE.test(v));
		if (districts.length > 0) {
			results.push({
				entry: {
					label: "Postcode District",
					boundaryType: "postcode",
					year: 0,
					matchType: "postcode-district",
					codes: new Set(districts.map(v => v.toUpperCase())),
					nameToCode: new Map(),
				},
				percentage: (districts.length / sampleSet.size) * 100,
				matchCount: districts.length,
			});
		}
	}

	// Coordinate detection: all unique values must be decimal numbers in coordinate range
	const nums = [...sampleSet].map(v => parseFloat(v));
	if (nums.every(n => !isNaN(n)) && [...sampleSet].some(v => v.includes("."))) {
		const min = Math.min(...nums);
		const max = Math.max(...nums);
		if (min >= -90 && max <= 90) {
			results.push({
				entry: { label: "Latitude", boundaryType: "coordinate", year: 0, matchType: "coordinate", codes: new Set(), nameToCode: new Map() },
				percentage: 100,
				matchCount: sampleSet.size,
			});
		} else if (min >= -180 && max <= 180) {
			results.push({
				entry: { label: "Longitude", boundaryType: "coordinate", year: 0, matchType: "coordinate", codes: new Set(), nameToCode: new Map() },
				percentage: 100,
				matchCount: sampleSet.size,
			});
		}
	}

	return results.sort((a, b) => b.percentage - a.percentage);
}
