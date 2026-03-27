// lib/utils/colorScale.ts
import type {
	BrexitOptions,
	CategoryOptions,
	ColorTheme,
	CrimeOptions,
	DensityOptions,
	EthnicityOptions,
	GenderOptions,
	HousePriceOptions,
	IMDOptions,
	IncomeOptions,
	LifeExpectancyOptions,
	PopulationOptions,
} from "@/lib/types/mapOptions";

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
	factor: number,
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
	themeId: string = "viridis",
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
		factor,
	);
}

/**
 * Shared implementation: normalise `value` within options.colorRange and return
 * an inverted theme colour. When `expandRange` is true the range expands to
 * always include the value (used for datasets where outliers exist).
 */
function colorFromRange(
	value: number,
	options: { colorRange: { min: number; max: number } },
	themeId: string,
	expandRange: boolean,
): string {
	const { min, max } = options.colorRange;
	const normalized = normalizeValue(
		value,
		expandRange ? Math.min(min, value) : min,
		expandRange ? Math.max(max, value) : max,
	);
	return getThemeColor(1 - normalized, themeId);
}

/** Gets colour for population/age data. */
export function getColorForAge(
	medianAge: number,
	mapOptions: PopulationOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(medianAge, mapOptions, themeId, false);
}

export function getColor(normalisedValue: number, themeId: string = "viridis") {
	return getThemeColor(1 - normalisedValue, themeId);
}

/** Gets colour for population density data. */
export function getColorForDensity(
	density: number,
	mapOptions: DensityOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(density, mapOptions, themeId, false);
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

/** Gets colour for house price data; range expands to include outlier values. */
export function getColorForHousePrice(
	price: number,
	options: HousePriceOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(price, options, themeId, true);
}

/** Gets colour for crime rate data; range expands to include outlier values. */
export function getColorForCrimeRate(
	rate: number,
	options: CrimeOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

/**
 * Gets colour for Brexit Leave percentage.
 * colorRange.min pctLeave → deep blue; 50% → white/neutral; colorRange.max pctLeave → deep red.
 * Values outside the range are clamped to the extreme colours.
 */
export function getColorForBrexitLeave(pctLeave: number, options: BrexitOptions): string {
	const midpoint = 50;
	const { min, max } = options.colorRange;
	if (pctLeave <= midpoint) {
		const factor = normalizeValue(pctLeave, min, midpoint);
		return interpolateColor("rgb(30, 60, 180)", "rgb(240, 240, 240)", factor);
	} else {
		const factor = normalizeValue(pctLeave, midpoint, max);
		return interpolateColor("rgb(240, 240, 240)", "rgb(180, 20, 20)", factor);
	}
}

/** Gets colour for IMD score data; higher score = more deprived, range expands to include outlier values. */
export function getColorForIMD(
	score: number,
	options: IMDOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(score, options, themeId, true);
}

/** Gets colour for life expectancy; higher = longer life = brighter colour (not inverted). */
export function getColorForLifeExpectancy(
	years: number,
	min: number,
	max: number,
	themeId: string = "viridis",
) {
	const normalized = normalizeValue(years, min, max);
	return getThemeColor(normalized, themeId);
}

/** Gets colour for income data; range expands to include outlier values. */
export function getColorForIncome(
	income: number,
	options: IncomeOptions,
	themeId: string = "viridis",
) {
	return colorFromRange(income, options, themeId, true);
}

/**
 * Gets color for gender ratio data with dynamic range
 * Note: This keeps custom logic (Pink/Blue) and does not use the generic themes
 */
export function getColorForGenderRatio(
	ratio: number,
	mapOptions: GenderOptions,
) {
	const range = mapOptions.colorRange;

	// Pink for female-skewed, blue for male-skewed, gray for balanced
	if (ratio < 0) {
		// Female-skewed: interpolate from pink to gray
		const factor = normalizeValue(ratio, range.min, 0);
		return interpolateColor(
			"rgba(255,105,180,0.8)",
			"rgba(240,240,240,0.8)",
			factor,
		);
	} else {
		// Male-skewed: interpolate from gray to blue
		const factor = normalizeValue(ratio, 0, range.max);
		return interpolateColor(
			"rgba(240,240,240,0.8)",
			"rgba(70,130,180,0.8)",
			factor,
		);
	}
}

/**
 * Gets Mapbox color expression for party percentage with dynamic range
 */
export function getPercentageColorExpression(
	color: string,
	mapOptions: CategoryOptions,
) {
	const range = mapOptions.percentageRange;

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
