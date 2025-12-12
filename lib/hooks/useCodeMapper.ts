// lib/hooks/useCodeMapper.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { BoundaryGeojson } from '@lib/types';
import { BoundaryType, PROPERTY_KEYS, getProp } from '../data/boundaries/boundaries';

export type CodeType = 'ward' | 'localAuthority' | 'constituency';
export type YearCode = number;

export interface CodeMapping {
    [fromCode: string]: {
        [toYear: number]: string;
    };
}

interface WardLadMapping {
    [wardCode: string]: string;
}

/**
 * Master code mapper hook
 */
export function useCodeMapper() {
    const [wardToLadMap, setWardToLadMap] = useState<WardLadMapping>({});
    const [codeMappings, setCodeMappings] = useState<{
        ward: CodeMapping;
        localAuthority: CodeMapping;
        constituency: CodeMapping;
    }>({
        ward: {},
        localAuthority: {},
        constituency: {}
    });

    // Use refs to avoid recreating callbacks
    const wardToLadMapRef = useRef(wardToLadMap);
    const codeMappingsRef = useRef(codeMappings);

    // Keep refs in sync
    wardToLadMapRef.current = wardToLadMap;
    codeMappingsRef.current = codeMappings;

    // ==================== Ward-to-LAD Mappings ====================

    const getLadForWard = useCallback((wardCode: string): string | undefined => {
        return wardToLadMapRef.current[wardCode];
    }, []); // Empty deps - uses ref

    const addWardLadMapping = useCallback((wardCode: string, localAuthorityCode: string) => {
        if (wardCode && localAuthorityCode) {
            setWardToLadMap(prev => ({
                ...prev,
                [wardCode]: localAuthorityCode
            }));
        }
    }, []); // Empty deps - only uses setState

    const addWardLadMappings = useCallback((mappings: WardLadMapping) => {
        setWardToLadMap(prev => ({
            ...prev,
            ...mappings
        }));
    }, []); // Empty deps - only uses setState

    // ==================== Cross-Year Code Mappings ====================

    const addCodeMapping = useCallback((
        type: CodeType,
        fromCode: string,
        toYear: YearCode,
        toCode: string
    ) => {
        if (!fromCode || !toYear || !toCode) return;

        setCodeMappings(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [fromCode]: {
                    ...prev[type][fromCode],
                    [toYear]: toCode
                }
            }
        }));
    }, []); // Empty deps - only uses setState

    const addCodeMappings = useCallback((
        type: CodeType,
        mappings: CodeMapping
    ) => {
        setCodeMappings(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                ...mappings
            }
        }));
    }, []);

    const getCodeForYear = useCallback((
        type: CodeType,
        code: string,
        targetYear: YearCode
    ): string | undefined => {
        return codeMappingsRef.current[type][code]?.[targetYear];
    }, []);

    const getAllEquivalentCodes = useCallback((
        type: CodeType,
        code: string
    ): { year: YearCode; code: string }[] => {
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
        targetYear: YearCode
    ): string[] => {
        const sourceCodes: string[] = [];
        const typeMapping = codeMappingsRef.current[type];

        for (const [sourceCode, yearMappings] of Object.entries(typeMapping)) {
            if (yearMappings[targetYear] === targetCode) {
                sourceCodes.push(sourceCode);
            }
        }

        return sourceCodes;
    }, []);

    /**
     * Get all codes that should be highlighted when hovering over a code
     */
    const getHighlightCodes = useCallback((
        type: CodeType,
        code: string
    ): Set<string> => {
        const codes = new Set<string>([code]);
        const typeMapping = codeMappingsRef.current[type];

        // Add all codes this maps to
        const directMappings = typeMapping[code] || {};
        for (const mappedCode of Object.values(directMappings)) {
            codes.add(mappedCode);
        }

        // Add all codes that map to this code (reverse lookup)
        for (const [sourceCode, yearMappings] of Object.entries(typeMapping)) {
            if (Object.values(yearMappings).includes(code)) {
                codes.add(sourceCode);
                // Also add other codes from the same source
                for (const mappedCode of Object.values(yearMappings)) {
                    codes.add(mappedCode);
                }
            }
        }

        return codes;
    }, []); // Empty deps - uses ref

    const clearAllMappings = useCallback(() => {
        setWardToLadMap({});
        setCodeMappings({
            ward: {},
            localAuthority: {},
            constituency: {}
        });
    }, []);

    const clearWardLadMap = useCallback(() => {
        setWardToLadMap({});
    }, []);

    const clearCodeMappings = useCallback((type?: CodeType) => {
        if (type) {
            setCodeMappings(prev => ({
                ...prev,
                [type]: {}
            }));
        } else {
            setCodeMappings({
                ward: {},
                localAuthority: {},
                constituency: {}
            });
        }
    }, []);

    const getMappingCounts = useCallback(() => {
        return {
            wardToLad: Object.keys(wardToLadMapRef.current).length,
            ward: Object.keys(codeMappingsRef.current.ward).length,
            localAuthority: Object.keys(codeMappingsRef.current.localAuthority).length,
            constituency: Object.keys(codeMappingsRef.current.constituency).length
        };
    }, []);

    return {
        getLadForWard,
        addWardLadMapping,
        addWardLadMappings,
        addCodeMapping,
        addCodeMappings,
        getCodeForYear,
        getAllEquivalentCodes,
        findSourceCodes,
        getHighlightCodes,
        clearAllMappings,
        clearWardLadMap,
        clearCodeMappings,
        getMappingCounts
    };
}

/**
 * Extract ward-to-LAD mappings from GeoJSON features
 */
export const extractWardLadMappings = (
    features: any[],
    wardCodeKeys: readonly string[],
    localAuthorityCodeKeys: readonly string[]
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
 * Build cross-year mappings from loaded GeoJSON data
 * This automatically extracts codes from all years and creates bidirectional mappings
 */
export const buildCrossYearMappings = (
    boundaryData: Record<number, BoundaryGeojson>,
    type: BoundaryType,
    years: number[]
): CodeMapping => {
    const mappings: CodeMapping = {};

    // Get the appropriate property keys for this boundary type
    const codeKeys =
        type === 'ward' ? PROPERTY_KEYS.wardCode :
            type === 'constituency' ? PROPERTY_KEYS.constituencyCode :
                PROPERTY_KEYS.ladCode;

    const nameKeys =
        type === 'ward' ? PROPERTY_KEYS.wardName :
            type === 'constituency' ? PROPERTY_KEYS.constituencyName :
                PROPERTY_KEYS.ladName;

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
                // Normalize name for matching
                const normalizedName = name.toLowerCase().trim();

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
export const buildCodeMappingsFromLookup = (
    lookupData: any[],
    codeFields: Record<YearCode, string>
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