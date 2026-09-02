import type {
	BrexitOptions,
	CategoryOptions,
	GenderOptions,
} from "@/lib/types/mapOptions";
import { normalizeValue, hexToRgb } from "./interpolation";
import { getThemeColor, themes } from "./themes";

type ColorRange = { min: number; max: number };

// Builds a MapLibre paint expression for scalar datasets. The source keeps the
// raw value so changing a theme or range only changes paint, rather than
// rebuilding and uploading every boundary feature.
export function getSequentialColorExpression(
	range: ColorRange,
	themeId: string,
	invertColor = true,
	property = "value",
): unknown[] {
	const theme = themes.find((candidate) => candidate.id === themeId) ?? themes[0];
	const colors = invertColor ? [...theme.colors].reverse() : theme.colors;
	if (range.min === range.max) {
		return [
			"case",
			["==", ["get", property], null],
			"#cccccc",
			getThemeColor(0.5, themeId),
		];
	}
	const span = range.max - range.min;
	const expression: unknown[] = ["interpolate", ["linear"], ["get", property]];

	colors.forEach((color, index) => {
		const position =
			colors.length <= 1
				? range.min
				: range.min + (span * index) / (colors.length - 1);
		expression.push(position, color);
	});

	return [
		"case",
		["==", ["get", property], null],
		"#cccccc",
		expression,
	];
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

export function getGenderColorExpression(
	range: GenderOptions["colorRange"],
	property = "value",
): unknown[] {
	const value = ["get", property];
	return [
		"case",
		["==", value, null],
		"#cccccc",
		["<", value, 0],
		[
			"interpolate",
			["linear"],
			value,
			range.min,
			"rgba(255, 105, 180, 0.8)",
			0,
			"rgba(240, 240, 240, 0.8)",
		],
		[
			"interpolate",
			["linear"],
			value,
			0,
			"rgba(240, 240, 240, 0.8)",
			range.max,
			"rgba(70, 130, 180, 0.8)",
		],
	];
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
