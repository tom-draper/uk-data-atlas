import type { ColorTheme } from "@/lib/types/mapOptions";
import { hexToRgb } from "./interpolation";

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
		id: "redblue" as ColorTheme,
		label: "Red-Blue",
		colors: ["#d73027", "#4575b4"],
	},
	{
		id: "ryg" as ColorTheme,
		label: "Red-Yellow-Green",
		colors: ["#d73027", "#fee08b", "#1a9850"],
	},
	{
		id: "brownteal" as ColorTheme,
		label: "Brown-Teal",
		colors: ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"],
	},
	{
		id: "purpleorange" as ColorTheme,
		label: "Purple-Orange",
		colors: ["#7b3294", "#c2a5cf", "#f7f7f7", "#fdb863", "#e66101"],
	},
	{
		id: "pinkgreen" as ColorTheme,
		label: "Pink-Green",
		colors: ["#c51b7d", "#e9a3c9", "#f7f7f7", "#a1d76a", "#4d9221"],
	},
	{
		id: "ylorrd" as ColorTheme,
		label: "Yellow-Orange-Red",
		colors: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
	},
	{
		id: "purplered" as ColorTheme,
		label: "Purple-Red",
		colors: [
			"#f1eef6",
			"#d4b9da",
			"#c994c7",
			"#df65b0",
			"#dd1c77",
			"#980043",
		],
	},
	{
		id: "turbo" as ColorTheme,
		label: "Turbo",
		colors: [
			"#30123b",
			"#4662d7",
			"#35aaf8",
			"#1ae4b6",
			"#72fe5e",
			"#c8ef34",
			"#faba39",
			"#f66b19",
			"#ca2a04",
			"#7a0403",
		],
	},
	{
		id: "coolwarm" as ColorTheme,
		label: "Cool-Warm",
		colors: [
			"#3b4cc0",
			"#6788ee",
			"#aabcfd",
			"#f7f7f7",
			"#f7a789",
			"#e26952",
			"#b40426",
		],
	},
	{
		id: "spectral" as ColorTheme,
		label: "Spectral",
		colors: [
			"#9e0142",
			"#d53e4f",
			"#f46d43",
			"#fdae61",
			"#fee08b",
			"#e6f598",
			"#abdda4",
			"#66c2a5",
			"#3288bd",
			"#5e4fa2",
		],
	},
	{
		id: "ylgnbu" as ColorTheme,
		label: "Yellow-Green-Blue",
		colors: [
			"#ffffd9",
			"#c7e9b4",
			"#7fcdbb",
			"#41b6c4",
			"#1d91c0",
			"#225ea8",
			"#0c2c84",
		],
	},
	{
		id: "ylgn" as ColorTheme,
		label: "Yellow-Green",
		colors: [
			"#ffffe5",
			"#f7fcb9",
			"#d9f0a3",
			"#addd8e",
			"#78c679",
			"#41ab5d",
			"#238443",
			"#005a32",
		],
	},
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

export function getThemeColor(
	normalizedValue: number,
	themeId: string = "viridis",
) {
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
