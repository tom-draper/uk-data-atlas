// lib/hooks/useWardLadMap.ts
'use client';

import { useState, useCallback } from 'react';

/**
 * Hook to manage ward-to-LAD mappings
 * Pass this hook to both boundary and election data loaders
 */
export function useWardLadMap() {
    const [wardToLadMap, setWardToLadMap] = useState<Record<string, string>>({});

    const getLadForWard = useCallback((wardCode: string) => {
        return wardToLadMap[wardCode];
    }, [wardToLadMap]);

    const addWardLadMapping = useCallback((wardCode: string, ladCode: string) => {
        if (wardCode && ladCode) {
            setWardToLadMap(prev => ({
                ...prev,
                [wardCode]: ladCode
            }));
        }
    }, []);

    const addWardLadMappings = useCallback((mappings: Record<string, string>) => {
        setWardToLadMap(prev => ({
            ...prev,
            ...mappings
        }));
    }, []);

    const clearWardLadMap = useCallback(() => {
        setWardToLadMap({});
    }, []);

    const getMappingCount = useCallback(() => {
        return Object.keys(wardToLadMap).length;
    }, [wardToLadMap]);

    return {
        getLadForWard,
        addWardLadMapping,
        addWardLadMappings,
        clearWardLadMap,
        getMappingCount
    };
}

/**
 * Utility to extract ward-to-LAD mappings from GeoJSON features
 */
export const extractWardLadMappings = (
    features: any[],
    wardCodeKeys: readonly string[],
    ladCodeKeys: readonly string[]
): Record<string, string> => {
    const mappings: Record<string, string> = {};

    for (const feature of features) {
        const props = feature.properties;
        if (!props) continue;

        // Find ward code
        let wardCode: string | undefined;
        for (const key of wardCodeKeys) {
            if (key in props && props[key]) {
                wardCode = props[key];
                break;
            }
        }

        // Find LAD code
        let ladCode: string | undefined;
        for (const key of ladCodeKeys) {
            if (key in props && props[key]) {
                ladCode = props[key];
                break;
            }
        }

        if (wardCode && ladCode) {
            mappings[wardCode] = ladCode;
        }
    }

    return mappings;
};