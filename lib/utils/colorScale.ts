// lib/utils/colorScale.ts
import type { GeneralElectionOptions, LocalElectionOptions, MapOptions } from '@/lib/types/mapOptions';

/**
 * Normalizes a value to a 0-1 range based on min/max bounds
 */
export function normalizeValue(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Interpolates between two colors based on a normalized value (0-1)
 */
export function interpolateColor(color1: string, color2: string, factor: number): string {
    // Parse RGB colors
    const c1 = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const c2 = color2.match(/\d+/g)?.map(Number) || [255, 255, 255];
    
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Gets color from viridis-like gradient (yellow -> green -> teal -> blue -> purple)
 */
export function getViridisColor(normalizedValue: number): string {
    const colors = [
        'rgb(68,1,84)',      // 0.0 - dark purple
        'rgb(59,82,139)',    // 0.25 - blue
        'rgb(33,145,140)',   // 0.5 - teal
        'rgb(94,201,98)',    // 0.75 - green
        'rgb(253,231,37)'    // 1.0 - yellow
    ];
    
    const index = normalizedValue * (colors.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const factor = index - lower;
    
    if (lower === upper) return colors[lower];
    return interpolateColor(colors[lower], colors[upper], factor);
}

/**
 * Gets color for population/age data with dynamic range
 */
export function getColorForAge(medianAge: number, mapOptions: MapOptions): string {
    const range = mapOptions.population.colorRange || { min: 25, max: 55 };
    const normalized = normalizeValue(medianAge, range.min, range.max);
    return getViridisColor(1 - normalized); // Invert so higher ages are darker
}

/**
 * Gets color for density data with dynamic range
 */
export function getColorForDensity(density: number, mapOptions: MapOptions): string {
    const range = mapOptions.density.colorRange || { min: 500, max: 10000 };
    const normalized = normalizeValue(density, range.min, range.max);
    return getViridisColor(1 - normalized); // Invert so higher density is darker
}

/**
 * Gets color for gender ratio data with dynamic range
 */
export function getColorForGenderRatio(ratio: number, mapOptions: MapOptions): string {
    const range = mapOptions.gender.colorRange || { min: -0.1, max: 0.1 };
    const normalized = normalizeValue(ratio, range.min, range.max);
    
    // Pink for female-skewed, blue for male-skewed, gray for balanced
    if (ratio < 0) {
        // Female-skewed: interpolate from pink to gray
        const factor = normalizeValue(ratio, range.min, 0);
        return interpolateColor('rgba(255,105,180,0.8)', 'rgba(240,240,240,0.8)', factor);
    } else {
        // Male-skewed: interpolate from gray to blue
        const factor = normalizeValue(ratio, 0, range.max);
        return interpolateColor('rgba(240,240,240,0.8)', 'rgba(70,130,180,0.8)', factor);
    }
}

/**
 * Converts hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Gets Mapbox color expression for party percentage with dynamic range
 */
export function getPartyPercentageColorExpression(
    partyColor: string,
    mapOptions: LocalElectionOptions | GeneralElectionOptions,
): any {
    const range = mapOptions.partyPercentageRange || { min: 0, max: 100 };
    
    const partyRgb = hexToRgb(partyColor);
    const lightRgb = { r: 245, g: 245, b: 245 };

    return [
        'case',
        ['==', ['get', 'percentage'], null],
        '#f5f5f5',
        [
            'interpolate',
            ['linear'],
            ['get', 'percentage'],
            range.min, `rgb(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b})`,
            range.max, `rgb(${partyRgb.r}, ${partyRgb.g}, ${partyRgb.b})`
        ]
    ];
}