// lib/hooks/useCodeMapper.ts
"use client";

import { useRef, useCallback, useMemo } from "react";
import type {
	CodeMapping,
	CodeType,
	YearCode,
} from "../data/boundaries/mappings";

export type { CodeMapping, CodeType, YearCode } from "../data/boundaries/mappings";

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
	const wardToLadMapRef = useRef<WardLadMapping>({});
	const ladToWardsMapRef = useRef<LadWardMapping>({});
	const constituencyToWardsMapRef = useRef<Record<number, Record<string, string[]>>>({});
	const codeMappingsRef = useRef<{
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

	// Reverse index: type → targetCode → set of source codes that map to it.
	// Built alongside codeMappingsRef so getHighlightCodes is O(1) instead of O(n).
	const reverseCodeMappingsRef = useRef<Record<CodeType, Record<string, Set<string>>>>({
		ward: {},
		localAuthority: {},
		constituency: {},
		lsoa: {},
		dataZone: {},
		superOutputArea: {},
	});

	// ==================== Ward-to-LAD Mappings ====================

	const getLadForWard = useCallback((wardCode: string): string | undefined => {
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
	}, []);

	const addWardLadMapping = useCallback((wardCode: string, localAuthorityCode: string) => {
		if (wardCode && localAuthorityCode) {
			wardToLadMapRef.current[wardCode] = localAuthorityCode;
		}
	}, []);

	const addWardLadMappings = useCallback((mappings: WardLadMapping) => {
		Object.assign(wardToLadMapRef.current, mappings);
	}, []);

	// ==================== LAD-to-Wards Mappings ====================

	const getWardsForLad = useCallback((ladCode: string, year: YearCode): string[] => {
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
	}, []);

	const addLadWardMapping = useCallback((year: YearCode, ladCode: string, wardCodes: string[]) => {
		if (!year || !ladCode || !wardCodes.length) return;
		if (!ladToWardsMapRef.current[year]) ladToWardsMapRef.current[year] = {};
		ladToWardsMapRef.current[year][ladCode] = wardCodes;
	}, []);

	const addLadWardMappings = useCallback((year: YearCode, mappings: Record<string, string[]>) => {
		if (!year) return;
		if (!ladToWardsMapRef.current[year]) ladToWardsMapRef.current[year] = {};
		Object.assign(ladToWardsMapRef.current[year], mappings);
	}, []);

	// ==================== Constituency-to-Wards Mappings ====================

	const addConstituencyWardMappings = useCallback((year: YearCode, mappings: Record<string, string[]>) => {
		if (!year) return;
		if (!constituencyToWardsMapRef.current[year]) constituencyToWardsMapRef.current[year] = {};
		Object.assign(constituencyToWardsMapRef.current[year], mappings);
	}, []);

	const getWardsForConstituency = useCallback((constituencyCode: string, wardYear: YearCode): string[] => {
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
	}, []);

	// ==================== Cross-Year Code Mappings ====================

	const addCodeMapping = useCallback((
		type: CodeType,
		fromCode: string,
		toYear: YearCode,
		toCode: string,
	) => {
		if (!fromCode || !toYear || !toCode) return;
		if (!codeMappingsRef.current[type][fromCode]) codeMappingsRef.current[type][fromCode] = {};
		codeMappingsRef.current[type][fromCode][toYear] = toCode;
		const rev = reverseCodeMappingsRef.current[type];
		if (!rev[toCode]) rev[toCode] = new Set();
		rev[toCode].add(fromCode);
	}, []);

	const addCodeMappings = useCallback((type: CodeType, mappings: CodeMapping) => {
		Object.assign(codeMappingsRef.current[type], mappings);
		const rev = reverseCodeMappingsRef.current[type];
		for (const [fromCode, yearMap] of Object.entries(mappings)) {
			for (const toCode of Object.values(yearMap)) {
				if (!rev[toCode]) rev[toCode] = new Set();
				rev[toCode].add(fromCode);
			}
		}
	}, []);

	const getCodeForYear = useCallback((
		type: CodeType,
		code: string,
		targetYear: YearCode,
	): string | undefined => {
		return codeMappingsRef.current[type][code]?.[targetYear];
	}, []);

	const getAllEquivalentCodes = useCallback((type: CodeType, code: string): { year: YearCode; code: string }[] => {
		const mappings = codeMappingsRef.current[type][code] || {};
		const equivalents: { year: YearCode; code: string }[] = [];

		for (const [year, mappedCode] of Object.entries(mappings)) {
			equivalents.push({ year: parseInt(year), code: mappedCode });
		}

		return equivalents;
	}, []);

	const findSourceCodes = useCallback((
		type: CodeType,
		targetCode: string,
		targetYear: YearCode,
	): string[] => {
		const sources = reverseCodeMappingsRef.current[type][targetCode];
		if (!sources) return [];
		return [...sources].filter(
			(src) => codeMappingsRef.current[type][src]?.[targetYear] === targetCode,
		);
	}, []);

	/**
	 * Get all codes that should be highlighted when hovering over a code.
	 * O(1) via pre-built reverse index instead of O(n) linear scan.
	 */
	const getHighlightCodes = useCallback((type: CodeType, code: string): Set<string> => {
		const codes = new Set<string>([code]);

		// Forward: all years this code maps to
		const forward = codeMappingsRef.current[type][code];
		if (forward) {
			for (const mappedCode of Object.values(forward)) codes.add(mappedCode);
		}

		// Reverse: all source codes that map to this code, plus their other targets
		const sources = reverseCodeMappingsRef.current[type][code];
		if (sources) {
			for (const sourceCode of sources) {
				codes.add(sourceCode);
				const sourceMappings = codeMappingsRef.current[type][sourceCode];
				if (sourceMappings) {
					for (const mappedCode of Object.values(sourceMappings)) codes.add(mappedCode);
				}
			}
		}

		return codes;
	}, []);

	const emptyCodeMappings = () => ({ ward: {}, localAuthority: {}, constituency: {}, lsoa: {}, dataZone: {}, superOutputArea: {} });

	const clearAllMappings = useCallback(() => {
		wardToLadMapRef.current = {};
		ladToWardsMapRef.current = {};
		constituencyToWardsMapRef.current = {};
		codeMappingsRef.current = emptyCodeMappings();
		reverseCodeMappingsRef.current = emptyCodeMappings();
	}, []);

	const clearWardLadMap = useCallback(() => {
		wardToLadMapRef.current = {};
	}, []);

	const clearLadWardMap = useCallback(() => {
		ladToWardsMapRef.current = {};
	}, []);

	const clearCodeMappings = useCallback((type?: CodeType) => {
		if (type) {
			codeMappingsRef.current[type] = {};
			reverseCodeMappingsRef.current[type] = {};
		} else {
			codeMappingsRef.current = emptyCodeMappings();
			reverseCodeMappingsRef.current = emptyCodeMappings();
		}
	}, []);

	const getMappingCounts = useCallback(() => {
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
	}, []);

	return useMemo(() => ({
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
	}), [
		getLadForWard, addWardLadMapping, addWardLadMappings, getWardsForLad,
		addLadWardMapping, addLadWardMappings, addConstituencyWardMappings,
		getWardsForConstituency, addCodeMapping, addCodeMappings, getCodeForYear,
		getAllEquivalentCodes, findSourceCodes, getHighlightCodes,
		clearAllMappings, clearWardLadMap, clearLadWardMap, clearCodeMappings,
		getMappingCounts,
	]);
}
