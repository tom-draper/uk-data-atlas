// lib/utils/colorScale.ts
import type {
    CategoryOptions,
    ColorTheme,
    CrimeOptions,
    DensityOptions,
    EthnicityOptions,
    GenderOptions,
    GeneralElectionOptions,
    HousePriceOptions,
    IncomeOptions,
    LocalElectionOptions,
    PopulationOptions,
} from "@/lib/types/mapOptions";
import { ColorRange } from "../types";

/**
 * Normalizes a value to a 0-1 range based on min/max bounds
 */
export function normalizeValue(value: number, min: number, max: number) {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Converts hex color to RGB object
 */
export function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : { r: 0, g: 0, b: 0 };
}

/**
 * Helper to convert hex to "rgb(r, g, b)" string for the interpolator
 */
function hexToRgbString(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Interpolates between two colors based on a normalized value (0-1)
 * Expects strings in format "rgb(r, g, b)"
 */
export function interpolateColor(
    color1: string,
    color2: string,
    factor: number
) {
    // Parse RGB colors
    const c1 = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const c2 = color2.match(/\d+/g)?.map(Number) || [255, 255, 255];

    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));

    return `rgb(${r}, ${g}, ${b})`;
}

// Define themes with specific color steps
const themeDefinitions = [
    {
        id: "viridis" as ColorTheme,
        label: "Viridis",
        colors: ["#440154", "#31688e", "#35b779", "#fde724"],
    },
    {
        id: "plasma" as ColorTheme,
        label: "Plasma",
        colors: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"],
    },
    {
        id: "inferno" as ColorTheme,
        label: "Inferno",
        colors: ["#000004", "#420a68", "#932667", "#fca236", "#fcfdbf"],
    },
    {
        id: "magma" as ColorTheme,
        label: "Magma",
        colors: ["#000004", "#3b0f70", "#8c2981", "#fcfdbf"],
    },
];

// Export themes with the generated gradient string for UI use
export const themes = themeDefinitions.map((t) => ({
    ...t,
    gradient: `linear-gradient(90deg, ${t.colors.join(", ")})`,
}));

/**
 * Gets color from a specific theme based on a normalized value (0-1)
 */
export function getThemeColor(
    normalizedValue: number,
    themeId: string = "viridis"
) {
    // Find theme or fallback to viridis
    const theme = themes.find((t) => t.id === themeId) || themes[0];
    const colors = theme.colors;

    // Calculate position in the color array
    const index = normalizedValue * (colors.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const factor = index - lower;

    if (lower === upper) return hexToRgbString(colors[lower]);

    return interpolateColor(
        hexToRgbString(colors[lower]),
        hexToRgbString(colors[upper]),
        factor
    );
}

/**
 * Gets color for population/age data with dynamic range
 */
export function getColorForAge(
    medianAge: number,
    mapOptions: PopulationOptions,
    themeId: string = "viridis"
) {
    const range = mapOptions.colorRange || { min: 25, max: 55 };
    const normalized = normalizeValue(medianAge, range.min, range.max);
    return getThemeColor(1 - normalized, themeId); // Invert so higher ages are darker (if using Viridis logic)
}

/**
 * Gets color for density data with dynamic range
 */
export function getColorForDensity(
    density: number,
    mapOptions: DensityOptions,
    themeId: string = "viridis"
) {
    const range = mapOptions.colorRange || { min: 500, max: 10000 };
    const normalized = normalizeValue(density, range.min, range.max);
    return getThemeColor(1 - normalized, themeId); // Invert so higher density is darker
}

// Ethnicity subcategory colors
export const ETHNICITY_COLORS: Record<string, string> = {
    "Asian, Asian British or Asian Welsh": "#0ea5e9", // Sky blue
    "Black, Black British, Black Welsh, Caribbean or African": "#14b8a6", // Teal
    "Mixed or Multiple ethnic groups": "#f97316", // Orange
    White: "#6366f1", // Indigo
    "Other ethnic group": "#a855f7", // Purple

    // Asian subcategories - Blues
    Bangladeshi: "#0ea5e9", // Sky blue
    Chinese: "#3b82f6", // Blue
    Indian: "#1d4ed8", // Deep blue
    Pakistani: "#60a5fa", // Light blue
    "Other Asian": "#93c5fd", // Lighter blue

    // Black subcategories - Greens/Teals
    African: "#14b8a6", // Teal
    Caribbean: "#10b981", // Emerald
    "Other Black": "#34d399", // Light green

    // Mixed subcategories - Oranges/Ambers
    "White and Asian": "#f97316", // Orange
    "White and Black African": "#fb923c", // Light orange
    "White and Black Caribbean": "#fdba74", // Lighter orange
    "Other Mixed or Multiple ethnic groups": "#fbbf24", // Amber

    // White subcategories - Purples
    "English, Welsh, Scottish, Northern Irish or British": "#8b5cf6", // Violet
    Irish: "#a78bfa", // Light violet
    "Gypsy or Irish Traveller": "#c4b5fd", // Lighter violet
    Roma: "#ddd6fe", // Very light violet
    "Other White": "#6366f1", // Indigo

    // Other subcategories - Pinks/Roses
    Arab: "#ec4899", // Pink
    "Any other ethnic group": "#f472b6", // Light pink
};

export function getColorForEthnicity(
    majorityEthnicity: string,
    ethnicityOptions: EthnicityOptions
): string {
    if (!majorityEthnicity) {
        return "#cccccc";
    }

    // Get the ethnicity category name
    if (!majorityEthnicity || !ETHNICITY_COLORS[majorityEthnicity]) {
        return "#cccccc";
    }

    return ETHNICITY_COLORS[majorityEthnicity];
}

/**
 * Gets color for house price data with dynamic range
 */
export function getColorForHousePrice(
    price: number,
    options: HousePriceOptions,
    themeId: string = "viridis"
) {
    const range = options.colorRange || { min: 80000, max: 500000 };
    const normalized = normalizeValue(
        price,
        Math.min(range.min, price),
        Math.max(range.max, price)
    );
    return getThemeColor(1 - normalized, themeId);
}

/**
 * Gets color for crime rate data with dynamic range
 */
export function getColorForCrimeRate(
    rate: number,
    options: CrimeOptions,
    themeId: string = "viridis"
) {
    const range = options.colorRange || { min: 0, max: 1000 };
    const normalized = normalizeValue(
        rate,
        Math.min(range.min, rate),
        Math.max(range.max, rate)
    );
    return getThemeColor(1 - normalized, themeId);
}

/**
 * Gets color for crime rate data with dynamic range
 */
export function getColorForIncome(
    income: number,
    options: IncomeOptions,
    themeId: string = "viridis"
) {
    const range = options.colorRange || { min: 20000, max: 40000 };
    const normalized = normalizeValue(
        income,
        Math.min(range.min, income),
        Math.max(range.max, income)
    );
    return getThemeColor(1 - normalized, themeId);
}

/**
 * Gets color for gender ratio data with dynamic range
 * Note: This keeps custom logic (Pink/Blue) and does not use the generic themes
 */
export function getColorForGenderRatio(
    ratio: number,
    mapOptions: GenderOptions
) {
    const range = mapOptions.colorRange || { min: -0.1, max: 0.1 };

    // Pink for female-skewed, blue for male-skewed, gray for balanced
    if (ratio < 0) {
        // Female-skewed: interpolate from pink to gray
        const factor = normalizeValue(ratio, range.min, 0);
        return interpolateColor(
            "rgba(255,105,180,0.8)",
            "rgba(240,240,240,0.8)",
            factor
        );
    } else {
        // Male-skewed: interpolate from gray to blue
        const factor = normalizeValue(ratio, 0, range.max);
        return interpolateColor(
            "rgba(240,240,240,0.8)",
            "rgba(70,130,180,0.8)",
            factor
        );
    }
}

/**
 * Gets Mapbox color expression for party percentage with dynamic range
 */
export function getPercentageColorExpression(
    color: string,
    mapOptions: CategoryOptions
) {
    const range = mapOptions.percentageRange || { min: 0, max: 100 };

    const partyRgb = hexToRgb(color);
    const lightRgb = { r: 245, g: 245, b: 245 };

    return [
        "case",
        ["==", ["get", "percentage"], null],
        "#f5f5f5",
        [
            "interpolate",
            ["linear"],
            ["get", "percentage"],
            range.min,
            `rgb(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b})`,
            range.max,
            `rgb(${partyRgb.r}, ${partyRgb.g}, ${partyRgb.b})`,
        ],
    ];
}

