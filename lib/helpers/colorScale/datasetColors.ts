import type {
	BrexitOptions,
	CategoryOptions,
	CrimeOptions,
	DensityOptions,
	GenderOptions,
	HousePriceOptions,
	IMDOptions,
	IncomeOptions,
	LifeExpectancyOptions,
	PopulationOptions,
} from "@/lib/types/mapOptions";
import { normalizeValue, hexToRgb, interpolateColor } from "./interpolation";
import { getThemeColor } from "./themes";

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

export function getColorForAge(medianAge: number, mapOptions: PopulationOptions, themeId = "viridis") {
	return colorFromRange(medianAge, mapOptions, themeId, false);
}

export function getColorForDensity(density: number, mapOptions: DensityOptions, themeId = "viridis") {
	return colorFromRange(density, mapOptions, themeId, false);
}

export function getColorForHousePrice(price: number, options: HousePriceOptions, themeId = "viridis") {
	return colorFromRange(price, options, themeId, true);
}

export function getColorForCrimeRate(rate: number, options: CrimeOptions, themeId = "viridis") {
	return colorFromRange(rate, options, themeId, true);
}

export function getColorForBrexitLeave(pctLeave: number, options: BrexitOptions): string {
	const midpoint = 50;
	const { min, max } = options.colorRange;
	if (pctLeave <= midpoint) {
		return interpolateColor("rgb(30, 60, 180)", "rgb(240, 240, 240)", normalizeValue(pctLeave, min, midpoint));
	} else {
		return interpolateColor("rgb(240, 240, 240)", "rgb(180, 20, 20)", normalizeValue(pctLeave, midpoint, max));
	}
}

export function getColorForIMD(score: number, options: IMDOptions, themeId = "viridis") {
	return colorFromRange(score, options, themeId, true);
}

export function getColorForLifeExpectancy(years: number, min: number, max: number, themeId = "viridis") {
	return getThemeColor(normalizeValue(years, min, max), themeId);
}

export function getColorForIncome(income: number, options: IncomeOptions, themeId = "viridis") {
	return colorFromRange(income, options, themeId, true);
}

export function getColorForGenderRatio(ratio: number, mapOptions: GenderOptions) {
	const range = mapOptions.colorRange;
	if (ratio < 0) {
		return interpolateColor("rgba(255,105,180,0.8)", "rgba(240,240,240,0.8)", normalizeValue(ratio, range.min, 0));
	} else {
		return interpolateColor("rgba(240,240,240,0.8)", "rgba(70,130,180,0.8)", normalizeValue(ratio, 0, range.max));
	}
}

export function getPercentageColorExpression(color: string, mapOptions: CategoryOptions, isDark = false) {
	const range = mapOptions.percentageRange;
	const partyRgb = hexToRgb(color);
	const neutralColor = isDark ? "#1f2937" : "#f5f5f5";
	const neutralRgb = hexToRgb(neutralColor);
	return [
		"case",
		["==", ["get", "percentage"], null],
		neutralColor,
		[
			"interpolate",
			["linear"],
			["get", "percentage"],
			range.min,
			`rgb(${neutralRgb.r}, ${neutralRgb.g}, ${neutralRgb.b})`,
			range.max,
			`rgb(${partyRgb.r}, ${partyRgb.g}, ${partyRgb.b})`,
		],
	];
}
