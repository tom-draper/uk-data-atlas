import type { ColorTheme } from "@/lib/types/mapOptions";
import { hexToRgbString, interpolateColor } from "./interpolation";

const themeDefinitions = [
	{ id: "viridis" as ColorTheme, label: "Viridis", colors: ["#440154", "#31688e", "#35b779", "#fde724"] },
	{ id: "plasma" as ColorTheme, label: "Plasma", colors: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"] },
	{ id: "inferno" as ColorTheme, label: "Inferno", colors: ["#000004", "#420a68", "#932667", "#fca236", "#fcfdbf"] },
	{ id: "magma" as ColorTheme, label: "Magma", colors: ["#000004", "#3b0f70", "#8c2981", "#fcfdbf"] },
];

export const themes = themeDefinitions.map((t) => ({
	...t,
	gradient: `linear-gradient(90deg, ${t.colors.join(", ")})`,
}));

export function getThemeColor(normalizedValue: number, themeId: string = "viridis") {
	const theme = themes.find((t) => t.id === themeId) || themes[0];
	const colors = theme.colors;
	const index = normalizedValue * (colors.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const factor = index - lower;
	if (lower === upper) return hexToRgbString(colors[lower]);
	return interpolateColor(hexToRgbString(colors[lower]), hexToRgbString(colors[upper]), factor);
}

export function getColor(normalisedValue: number, themeId: string = "viridis") {
	return getThemeColor(1 - normalisedValue, themeId);
}
