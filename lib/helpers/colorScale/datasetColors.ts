import type {
	BrexitOptions,
	CategoryOptions,
	CrimeOptions,
	DensityOptions,
	GenderOptions,
	HousePriceOptions,
	IMDOptions,
	SIMDOptions,
	WIMDOptions,
	NIMDMOptions,
	IncomeOptions,
	PopulationOptions,
	QualificationOptions,
	BroadbandOptions,
	AirQualityOptions,
	SchoolPerformanceOptions,
	ClaimantCountOptions,
	NHSWaitingOptions,
	UnemploymentOptions,
	ChildPovertyOptions,
	HomelessnessOptions,
} from "@/lib/types/mapOptions";
import { normalizeValue, hexToRgb } from "./interpolation";
import { getThemeColor } from "./themes";

function colorFromRange(
	value: number,
	options: { colorRange: { min: number; max: number } },
	themeId: string,
	expandRange: boolean,
	invertColor = true,
): string {
	const { min, max } = options.colorRange;
	const normalized = normalizeValue(
		value,
		expandRange ? Math.min(min, value) : min,
		expandRange ? Math.max(max, value) : max,
	);
	return getThemeColor(invertColor ? 1 - normalized : normalized, themeId);
}

export function getColorForAge(
	medianAge: number,
	mapOptions: PopulationOptions,
	themeId = "viridis",
) {
	return colorFromRange(medianAge, mapOptions, themeId, false);
}

export function getColorForDensity(
	density: number,
	mapOptions: DensityOptions,
	themeId = "viridis",
) {
	return colorFromRange(density, mapOptions, themeId, false);
}

export function getColorForHousePrice(
	price: number,
	options: HousePriceOptions,
	themeId = "viridis",
) {
	return colorFromRange(price, options, themeId, true);
}

export function getColorForCrimeRate(
	rate: number,
	options: CrimeOptions,
	themeId = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

// Pre-parsed color tuples — avoids regex on every feature
const REMAIN_RGB = [30, 60, 180] as const;
const NEUTRAL_RGB = [240, 240, 240] as const;
const LEAVE_RGB = [180, 20, 20] as const;

function lerpRgb(
	r1: number,
	g1: number,
	b1: number,
	r2: number,
	g2: number,
	b2: number,
	t: number,
) {
	return `rgb(${Math.round(r1 + t * (r2 - r1))}, ${Math.round(g1 + t * (g2 - g1))}, ${Math.round(b1 + t * (b2 - b1))})`;
}

export function getColorForBrexitLeave(
	pctLeave: number,
	options: BrexitOptions,
): string {
	const midpoint = 50;
	const { min, max } = options.colorRange;
	if (pctLeave <= midpoint) {
		const t = normalizeValue(pctLeave, min, midpoint);
		return lerpRgb(
			REMAIN_RGB[0],
			REMAIN_RGB[1],
			REMAIN_RGB[2],
			NEUTRAL_RGB[0],
			NEUTRAL_RGB[1],
			NEUTRAL_RGB[2],
			t,
		);
	} else {
		const t = normalizeValue(pctLeave, midpoint, max);
		return lerpRgb(
			NEUTRAL_RGB[0],
			NEUTRAL_RGB[1],
			NEUTRAL_RGB[2],
			LEAVE_RGB[0],
			LEAVE_RGB[1],
			LEAVE_RGB[2],
			t,
		);
	}
}

export function getColorForIMD(
	score: number,
	options: IMDOptions,
	themeId = "viridis",
) {
	return colorFromRange(score, options, themeId, true);
}

export function getColorForSIMD(
	rank: number,
	options: SIMDOptions,
	themeId = "viridis",
) {
	return colorFromRange(rank, options, themeId, false, false);
}

export function getColorForWIMD(
	rank: number,
	options: WIMDOptions,
	themeId = "viridis",
) {
	return colorFromRange(rank, options, themeId, false, false);
}

export function getColorForNIMDM(
	rank: number,
	options: NIMDMOptions,
	themeId = "viridis",
) {
	return colorFromRange(rank, options, themeId, false, false);
}

export function getColorForLifeExpectancy(
	years: number,
	min: number,
	max: number,
	themeId = "viridis",
) {
	return getThemeColor(normalizeValue(years, min, max), themeId);
}

export function getColorForQualification(
	pctLevel4Plus: number,
	options: QualificationOptions,
	themeId = "viridis",
) {
	return colorFromRange(pctLevel4Plus, options, themeId, true);
}

export function getColorForIncome(
	income: number,
	options: IncomeOptions,
	themeId = "viridis",
) {
	return colorFromRange(income, options, themeId, true);
}

export function getColorForBroadband(
	speedMbps: number,
	options: BroadbandOptions,
	themeId = "viridis",
) {
	return colorFromRange(speedMbps, options, themeId, true);
}

export function getColorForAirQuality(
	no2Mean: number,
	options: AirQualityOptions,
	themeId = "viridis",
) {
	return colorFromRange(no2Mean, options, themeId, true);
}

export function getColorForSchoolPerformance(
	pct: number,
	options: SchoolPerformanceOptions,
	themeId = "viridis",
) {
	return colorFromRange(pct, options, themeId, true);
}

export function getColorForClaimantCount(
	rate: number,
	options: ClaimantCountOptions,
	themeId = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

export function getColorForUnemployment(
	rate: number,
	options: UnemploymentOptions,
	themeId = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

export function getColorForChildPoverty(
	rate: number,
	options: ChildPovertyOptions,
	themeId = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

export function getColorForHomelessness(
	rate: number,
	options: HomelessnessOptions,
	themeId = "viridis",
) {
	return colorFromRange(rate, options, themeId, true);
}

export function getColorForNHSWaiting(
	pct: number,
	options: NHSWaitingOptions,
	themeId = "viridis",
) {
	return colorFromRange(pct, options, themeId, true);
}

const FEMALE_RGB = [255, 105, 180] as const;
const MALE_RGB = [70, 130, 180] as const;

export function getColorForGenderRatio(
	ratio: number,
	mapOptions: GenderOptions,
) {
	const range = mapOptions.colorRange;
	if (ratio < 0) {
		const t = normalizeValue(ratio, range.min, 0);
		return `rgba(${Math.round(FEMALE_RGB[0] + t * (NEUTRAL_RGB[0] - FEMALE_RGB[0]))}, ${Math.round(FEMALE_RGB[1] + t * (NEUTRAL_RGB[1] - FEMALE_RGB[1]))}, ${Math.round(FEMALE_RGB[2] + t * (NEUTRAL_RGB[2] - FEMALE_RGB[2]))}, 0.8)`;
	} else {
		const t = normalizeValue(ratio, 0, range.max);
		return `rgba(${Math.round(NEUTRAL_RGB[0] + t * (MALE_RGB[0] - NEUTRAL_RGB[0]))}, ${Math.round(NEUTRAL_RGB[1] + t * (MALE_RGB[1] - NEUTRAL_RGB[1]))}, ${Math.round(NEUTRAL_RGB[2] + t * (MALE_RGB[2] - NEUTRAL_RGB[2]))}, 0.8)`;
	}
}

export function getPercentageColorExpression(
	color: string,
	mapOptions: CategoryOptions,
	isDark = false,
) {
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
