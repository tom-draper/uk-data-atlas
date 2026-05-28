// lib/hooks/useCodeMapper.ts
"use client";

import { useState, useRef, useCallback } from "react";
import { BoundaryGeojson, Features } from "@lib/types";
import {
	BoundaryType,
	PROPERTY_KEYS,
	getProp,
} from "../data/boundaries/boundaries";

export type CodeType =
	| "ward"
	| "localAuthority"
	| "constituency"
	| "lsoa"
	| "dataZone"
	| "superOutputArea";
export type YearCode = number;

/** Shared type for the codeMapper prop passed to chart sections and sub-components. */
export interface CodeMapper {
	getCodeForYear: (
		type: CodeType,
		code: string,
		targetYear: number,
	) => string | undefined;
	getWardsForLad: (ladCode: string, year: number) => string[];
	getWardsForConstituency: (
		constituencyCode: string,
		wardYear: number,
	) => string[];
}

export interface CodeMapping {
	[fromCode: string]: {
		[toYear: number]: string;
	};
}

interface WardLadMapping {
	[wardCode: string]: string;
}

interface LadWardMapping {
	[year: number]: {
		[ladCode: string]: string[];
	};
}

/**
 * Master code mapper hook
 */
export function useCodeMapper() {
	const [wardToLadMap, setWardToLadMap] = useState<WardLadMapping>({});
	const [ladToWardsMap, setLadToWardsMap] = useState<LadWardMapping>({});
	const [constituencyToWardsMap, setConstituencyToWardsMap] = useState<
		Record<number, Record<string, string[]>>
	>({});
	const [codeMappings, setCodeMappings] = useState<{
		ward: CodeMapping;
		localAuthority: CodeMapping;
		constituency: CodeMapping;
		lsoa: CodeMapping;
		dataZone: CodeMapping;
		superOutputArea: CodeMapping;
	}>({
		ward: {},
		localAuthority: {},
		constituency: {},
		lsoa: {},
		dataZone: {},
		superOutputArea: {},
	});

	// Use refs to avoid recreating callbacks
	const wardToLadMapRef = useRef(wardToLadMap);
	const ladToWardsMapRef = useRef(ladToWardsMap);
	const constituencyToWardsMapRef = useRef(constituencyToWardsMap);
	const codeMappingsRef = useRef(codeMappings);

	// Keep refs in sync
	wardToLadMapRef.current = wardToLadMap;
	ladToWardsMapRef.current = ladToWardsMap;
	constituencyToWardsMapRef.current = constituencyToWardsMap;
	codeMappingsRef.current = codeMappings;

	// ==================== Ward-to-LAD Mappings ====================

	const getLadForWard = (wardCode: string): string | undefined => {
		const direct = wardToLadMapRef.current[wardCode];
		if (direct) return direct;

		// Fall back to cross-year equivalents (e.g. 2021 ward codes not in LAD map)
		const yearMappings = codeMappingsRef.current.ward[wardCode];
		if (yearMappings) {
			for (const equivalentCode of Object.values(yearMappings)) {
				const lad =
					wardToLadMapRef.current[equivalentCode as string];
				if (lad) return lad;
			}
		}

		return undefined;
	};

	const addWardLadMapping = (wardCode: string, localAuthorityCode: string) => {
		if (wardCode && localAuthorityCode) {
			setWardToLadMap((prev) => ({
				...prev,
				[wardCode]: localAuthorityCode,
			}));
		}
	};

	const addWardLadMappings = useCallback((mappings: WardLadMapping) => {
		setWardToLadMap((prev) => ({
			...prev,
			...mappings,
		}));
	}, []);

	// ==================== LAD-to-Wards Mappings ====================

	const getWardsForLad = (ladCode: string, year: YearCode): string[] => {
		const direct = ladToWardsMapRef.current[year]?.[ladCode];
		if (direct?.length) return direct;
		// Some ward GeoJSON years don't embed LAD codes (e.g. 2023 has no LAD23CD).
		// Fall back through available years to find a mapping for this LAD.
		const map = ladToWardsMapRef.current;
		const fallbackYears = [2024, 2022, 2021, 2023].filter(
			(y) => y !== year,
		);
		for (const fy of fallbackYears) {
			const result = map[fy]?.[ladCode];
			if (result?.length) return result;
		}
		return [];
	};

	const addLadWardMapping = (year: YearCode, ladCode: string, wardCodes: string[]) => {
		if (!year || !ladCode || !wardCodes.length) return;

		setLadToWardsMap((prev) => ({
			...prev,
			[year]: {
				...prev[year],
				[ladCode]: wardCodes,
			},
		}));
	};

	const addLadWardMappings = useCallback((year: YearCode, mappings: Record<string, string[]>) => {
		if (!year) return;

		setLadToWardsMap((prev) => ({
			...prev,
			[year]: {
				...prev[year],
				...mappings,
			},
		}));
	}, []);

	// ==================== Constituency-to-Wards Mappings ====================

	const addConstituencyWardMappings = useCallback((year: YearCode, mappings: Record<string, string[]>) => {
		if (!year) return;
		setConstituencyToWardsMap((prev) => ({
			...prev,
			[year]: { ...prev[year], ...mappings },
		}));
	}, []);

	const getWardsForConstituency = (constituencyCode: string, wardYear: YearCode): string[] => {
		// Direct lookup for this ward year
		const direct =
			constituencyToWardsMapRef.current[wardYear]?.[constituencyCode];
		if (direct?.length) return direct;

		// If not found, try mapping the constituency code to 2024 (the reference year
		// used when building the constituency->wards index) via cross-year mapping
		const pcon2024 =
			codeMappingsRef.current.constituency[constituencyCode]?.[2024];
		if (pcon2024) {
			return (
				constituencyToWardsMapRef.current[wardYear]?.[pcon2024] ||
				[]
			);
		}
		return [];
	};

	// ==================== Cross-Year Code Mappings ====================

	const addCodeMapping = (
		type: CodeType,
		fromCode: string,
		toYear: YearCode,
		toCode: string,
	) => {
		if (!fromCode || !toYear || !toCode) return;

		setCodeMappings((prev) => ({
			...prev,
			[type]: {
				...prev[type],
				[fromCode]: {
					...prev[type][fromCode],
					[toYear]: toCode,
				},
			},
		}));
	};

	const addCodeMappings = useCallback((type: CodeType, mappings: CodeMapping) => {
		setCodeMappings((prev) => ({
			...prev,
			[type]: {
				...prev[type],
				...mappings,
			},
		}));
	}, []);

	const getCodeForYear = useCallback((
		type: CodeType,
		code: string,
		targetYear: YearCode,
	): string | undefined => {
		return codeMappingsRef.current[type][code]?.[targetYear];
	}, []);

	const getAllEquivalentCodes = (type: CodeType, code: string): { year: YearCode; code: string }[] => {
		const mappings = codeMappingsRef.current[type][code] || {};
		const equivalents: { year: YearCode; code: string }[] = [];

		for (const [year, mappedCode] of Object.entries(mappings)) {
			equivalents.push({ year: parseInt(year), code: mappedCode });
		}

		return equivalents;
	};

	const findSourceCodes = (
		type: CodeType,
		targetCode: string,
		targetYear: YearCode,
	): string[] => {
		const sourceCodes: string[] = [];
		const typeMapping = codeMappingsRef.current[type];

		for (const [sourceCode, yearMappings] of Object.entries(
			typeMapping,
		)) {
			if (yearMappings[targetYear] === targetCode) {
				sourceCodes.push(sourceCode);
			}
		}

		return sourceCodes;
	};

	/**
	 * Get all codes that should be highlighted when hovering over a code
	 */
	const getHighlightCodes = (type: CodeType, code: string): Set<string> => {
		const codes = new Set<string>([code]);
		const typeMapping = codeMappingsRef.current[type];

		// Add all codes this maps to
		const directMappings = typeMapping[code] || {};
		for (const mappedCode of Object.values(directMappings)) {
			codes.add(mappedCode);
		}

		// Add all codes that map to this code (reverse lookup)
		for (const [sourceCode, yearMappings] of Object.entries(
			typeMapping,
		)) {
			const mappedValues = new Set(Object.values(yearMappings));
			if (mappedValues.has(code)) {
				codes.add(sourceCode);
				// Also add other codes from the same source
				for (const mappedCode of Object.values(yearMappings)) {
					codes.add(mappedCode);
				}
			}
		}

		return codes;
	};

	const clearAllMappings = () => {
		setWardToLadMap({});
		setLadToWardsMap({});
		setCodeMappings({
			ward: {},
			localAuthority: {},
			constituency: {},
			lsoa: {},
			dataZone: {},
			superOutputArea: {},
		});
	};

	const clearWardLadMap = () => {
		setWardToLadMap({});
	};

	const clearLadWardMap = () => {
		setLadToWardsMap({});
	};

	const clearCodeMappings = (type?: CodeType) => {
		if (type) {
			setCodeMappings((prev) => ({
				...prev,
				[type]: {},
			}));
		} else {
			setCodeMappings({
				ward: {},
				localAuthority: {},
				constituency: {},
				lsoa: {},
				dataZone: {},
				superOutputArea: {},
			});
		}
	};

	const getMappingCounts = () => {
		const ladWardCounts: Record<number, number> = {};
		for (const [year, yearMap] of Object.entries(
			ladToWardsMapRef.current,
		)) {
			ladWardCounts[parseInt(year)] = Object.keys(yearMap).length;
		}

		return {
			wardToLad: Object.keys(wardToLadMapRef.current).length,
			ladToWards: ladWardCounts,
			ward: Object.keys(codeMappingsRef.current.ward).length,
			localAuthority: Object.keys(codeMappingsRef.current.localAuthority)
				.length,
			constituency: Object.keys(codeMappingsRef.current.constituency)
				.length,
		};
	};

	return {
		getLadForWard,
		addWardLadMapping,
		addWardLadMappings,
		getWardsForLad,
		addLadWardMapping,
		addLadWardMappings,
		addConstituencyWardMappings,
		getWardsForConstituency,
		addCodeMapping,
		addCodeMappings,
		getCodeForYear,
		getAllEquivalentCodes,
		findSourceCodes,
		getHighlightCodes,
		clearAllMappings,
		clearWardLadMap,
		clearLadWardMap,
		clearCodeMappings,
		getMappingCounts,
	};
}

/**
 * Extract ward-to-LAD mappings from GeoJSON features
 */
export const extractWardLadMappings = (
	features: Features,
	wardCodeKeys: readonly string[],
	localAuthorityCodeKeys: readonly string[],
): WardLadMapping => {
	const mappings: WardLadMapping = {};

	for (const feature of features) {
		const props = feature.properties;
		if (!props) continue;

		const wardCode = getProp(props, wardCodeKeys);
		const localAuthorityCode = getProp(props, localAuthorityCodeKeys);

		if (wardCode && localAuthorityCode) {
			mappings[wardCode] = localAuthorityCode;
		}
	}

	return mappings;
};

/**
 * Extract LAD-to-wards mappings from GeoJSON features (inverse of ward-to-LAD)
 */
export const extractLadWardMappings = (
	features: Features,
	wardCodeKeys: readonly string[],
	localAuthorityCodeKeys: readonly string[],
): Record<string, string[]> => {
	const mappingsSets: Record<string, Set<string>> = {};

	for (const feature of features) {
		const props = feature.properties;
		if (!props) continue;

		const wardCode = getProp(props, wardCodeKeys);
		const localAuthorityCode = getProp(props, localAuthorityCodeKeys);

		if (wardCode && localAuthorityCode) {
			if (!mappingsSets[localAuthorityCode]) {
				mappingsSets[localAuthorityCode] = new Set();
			}
			mappingsSets[localAuthorityCode].add(wardCode);
		}
	}

	return Object.fromEntries(
		Object.entries(mappingsSets).map(([k, v]) => [k, [...v]]),
	);
};

/**
 * Build cross-year mappings from loaded GeoJSON data
 * This automatically extracts codes from all years and creates bidirectional mappings
 */
export const buildCrossYearMappings = (
	boundaryData: Record<number, BoundaryGeojson>,
	type: BoundaryType,
	years: number[],
): CodeMapping => {
	const mappings: CodeMapping = {};

	// Get the appropriate property keys for this boundary type
	const codeKeys =
		type === "ward"
			? PROPERTY_KEYS.wardCode
			: type === "constituency"
				? PROPERTY_KEYS.constituencyCode
				: PROPERTY_KEYS.ladCode;

	const nameKeys =
		type === "ward"
			? PROPERTY_KEYS.wardName
			: type === "constituency"
				? PROPERTY_KEYS.constituencyName
				: PROPERTY_KEYS.ladName;

	// Build a name-to-codes index for fuzzy matching
	const nameIndex: Record<string, Set<{ code: string; year: number }>> = {};

	for (const year of years) {
		const geojson = boundaryData[year];
		if (!geojson?.features) continue;

		for (const feature of geojson.features) {
			const props = feature.properties;
			if (!props) continue;

			const code = getProp(props, codeKeys);
			const name = getProp(props, nameKeys);

			if (code && name) {
				// For ward boundaries, scope name matching within LAD to prevent
				// cross-authority collisions (e.g. two areas both having a "Pemberton" ward).
				const ladCode =
					type === "ward"
						? getProp(props, PROPERTY_KEYS.ladCode)
						: null;
				const normalizedName = ladCode
					? `${name.toLowerCase().trim()}|${ladCode}`
					: name.toLowerCase().trim();

				if (!nameIndex[normalizedName]) {
					nameIndex[normalizedName] = new Set();
				}
				nameIndex[normalizedName].add({ code, year });
			}
		}
	}

	// Build mappings based on name matching
	for (const [name, codeSet] of Object.entries(nameIndex)) {
		const codes = Array.from(codeSet);

		// For each code, map it to all other codes with the same name
		for (const { code: fromCode, year: fromYear } of codes) {
			if (!mappings[fromCode]) {
				mappings[fromCode] = {};
			}

			for (const { code: toCode, year: toYear } of codes) {
				if (fromYear !== toYear) {
					mappings[fromCode][toYear] = toCode;
				}
			}
		}
	}

	return mappings;
};

/**
 * Build mappings from a lookup table/CSV with explicit year columns
 */
const buildCodeMappingsFromLookup = (
	lookupData: any[],
	codeFields: Record<YearCode, string>,
): CodeMapping => {
	const mappings: CodeMapping = {};
	const years = Object.keys(codeFields).map(Number);

	for (const row of lookupData) {
		for (const fromYear of years) {
			const fromField = codeFields[fromYear];
			const fromCode = row[fromField];

			if (!fromCode) continue;

			if (!mappings[fromCode]) {
				mappings[fromCode] = {};
			}

			for (const toYear of years) {
				if (toYear === fromYear) continue;

				const toField = codeFields[toYear];
				const toCode = row[toField];

				if (toCode) {
					mappings[fromCode][toYear] = toCode;
				}
			}
		}
	}

	return mappings;
};

function pointInPolygon(px: number, py: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0],
			yi = ring[i][1];
		const xj = ring[j][0],
			yj = ring[j][1];
		if (
			yi > py !== yj > py &&
			px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
		) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Build constituency->wards mappings by testing ward polygon centroids against
 * constituency polygons. Uses 2024 constituency boundaries as the reference so
 * that any PCON24CD code encountered at hover time maps directly.
 * Runs once after both boundary groups are loaded.
 */
export const buildConstituencyWardMappings = (
	wardGeoJSON: BoundaryGeojson,
	constituencyGeoJSON: BoundaryGeojson,
): Record<string, string[]> => {
	interface ConEntry {
		code: string;
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		rings: number[][][];
	}

	const constituencies: ConEntry[] = [];
	for (const feature of constituencyGeoJSON.features) {
		const code = getProp(
			feature.properties,
			PROPERTY_KEYS.constituencyCode,
		);
		if (!code) continue;

		const geom = feature.geometry as any;
		const outerRings: number[][][] =
			geom.type === "MultiPolygon"
				? (geom.coordinates as number[][][][]).map(
						(p: number[][][]) => p[0],
					)
				: [geom.coordinates[0] as number[][]];

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (const ring of outerRings) {
			for (const [x, y] of ring) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
		constituencies.push({
			code,
			minX,
			minY,
			maxX,
			maxY,
			rings: outerRings,
		});
	}

	const mappings: Record<string, string[]> = {};

	for (const feature of wardGeoJSON.features) {
		const wardCode = getProp(feature.properties, PROPERTY_KEYS.wardCode);
		if (!wardCode) continue;

		const geom = feature.geometry as any;
		const outerRing: number[][] =
			geom.type === "MultiPolygon"
				? (geom.coordinates as number[][][][])[0][0]
				: geom.coordinates[0];

		let cx = 0,
			cy = 0;
		for (const [x, y] of outerRing) {
			cx += x;
			cy += y;
		}
		cx /= outerRing.length;
		cy /= outerRing.length;

		for (const con of constituencies) {
			if (
				cx < con.minX ||
				cx > con.maxX ||
				cy < con.minY ||
				cy > con.maxY
			)
				continue;

			let matched = false;
			for (const ring of con.rings) {
				if (pointInPolygon(cx, cy, ring)) {
					matched = true;
					break;
				}
			}

			if (matched) {
				if (!mappings[con.code]) mappings[con.code] = [];
				mappings[con.code].push(wardCode);
				break;
			}
		}
	}

	return mappings;
};
