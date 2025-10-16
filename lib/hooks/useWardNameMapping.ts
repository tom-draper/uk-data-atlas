import { useMemo } from 'react';

export interface WardGeojson {
    features: Array<{
        properties: {
            WD24CD?: string;
            WD23CD?: string;
            WD22CD?: string;
            WD21CD?: string;
            WD23NM?: string;
        };
    }>;
}

export interface WardNameMapping {
    nameToCode: Record<string, string>;
    codeToName: Record<string, string>;
}

/**
 * Creates bidirectional mapping between ward names and population codes
 * 
 * @param geojson - Ward boundary GeoJSON data
 * @param populationCodes - Array of valid population ward codes to match against
 * @returns Object with nameToCode and codeToName mappings
 * 
 * @example
 * const { nameToCode, codeToName } = useWardNameMapping(geojson, ['E05011234', 'E05011235']);
 * const code = nameToCode['abbey ward']; // 'E05011234'
 * const name = codeToName['E05011234']; // 'Abbey Ward'
 */
export function useWardNameMapping(
    geojson: WardGeojson | null,
    populationCodes: string[]
): WardNameMapping {
    return useMemo(() => {
        const nameToCode: Record<string, string> = {};
        const codeToName: Record<string, string> = {};

        // Early exit if no data
        if (!geojson || !populationCodes || populationCodes.length === 0) {
            return { nameToCode, codeToName };
        }

        const popCodesSet = new Set(populationCodes);

        // Single pass through features for O(n) performance
        for (const feature of geojson.features) {
            const props = feature.properties;

            // Check all possible year codes
            const codes = [
                props.WD24CD,
                props.WD23CD,
                props.WD22CD,
                props.WD21CD
            ].filter(Boolean) as string[];

            const wardName = props.WD23NM?.trim();
            if (!wardName) continue;

            // Find first matching code
            const matchedCode = codes.find(code => popCodesSet.has(code));

            if (matchedCode) {
                // Store lowercase version for case-insensitive lookups
                const normalizedName = wardName.toLowerCase();
                nameToCode[normalizedName] = matchedCode;

                // Store original capitalization for display
                codeToName[matchedCode] = wardName;
            }
        }

        return { nameToCode, codeToName };
    }, [geojson, populationCodes]);
}

/**
 * Helper hook to get population codes from population data
 * 
 * @param populationData - Object keyed by ward codes
 * @returns Array of ward codes
 */
export function usePopulationCodes(
    populationData: Record<string, any> | null | undefined
): string[] {
    return useMemo(() => {
        if (!populationData) return [];
        return Object.keys(populationData);
    }, [populationData]);
}
