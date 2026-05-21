import type { ColorTheme } from "@/lib/types/mapOptions";
import { hexToRgb } from "./interpolation";

const themeDefinitions = [
	{ id: "viridis" as ColorTheme, label: "Viridis", colors: ["#440154", "#31688e", "#35b779", "#fde724"] },
	{ id: "plasma" as ColorTheme, label: "Plasma", colors: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"] },
	{ id: "redblue" as ColorTheme, label: "Red-Blue", colors: ["#d73027", "#4575b4"] },
	{ id: "ryg" as ColorTheme, label: "Red-Yellow-Green", colors: ["#d73027", "#fee08b", "#1a9850"] },
];

type RGB = [number, number, number];

// Pre-parse hex stops to RGB tuples once at module load — avoids regex on every feature render
const themeRgb = themeDefinitions.map((t) => ({
	...t,
	rgbColors: t.colors.map((hex): RGB => {
		const { r, g, b } = hexToRgb(hex);
		return [r, g, b];
	}),
}));

export const themes = themeDefinitions.map((t) => ({
	...t,
	gradient: `linear-gradient(90deg, ${t.colors.join(", ")})`,
}));

export function getThemeColor(normalizedValue: number, themeId: string = "viridis") {
	const theme = themeRgb.find((t) => t.id === themeId) ?? themeRgb[0];
	const colors = theme.rgbColors;
	const index = normalizedValue * (colors.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	if (lower === upper) {
		const [r, g, b] = colors[lower];
		return `rgb(${r}, ${g}, ${b})`;
	}
	const factor = index - lower;
	const [r1, g1, b1] = colors[lower];
	const [r2, g2, b2] = colors[upper];
	return `rgb(${Math.round(r1 + factor * (r2 - r1))}, ${Math.round(g1 + factor * (g2 - g1))}, ${Math.round(b1 + factor * (b2 - b1))})`;
}

export function getColor(normalisedValue: number, themeId: string = "viridis") {
	return getThemeColor(1 - normalisedValue, themeId);
}
