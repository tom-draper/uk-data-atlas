export interface BaseMapStyle {
	id: "positron" | "darkMatter" | "voyager";
	label: string;
	url: string;
}

export const BASE_MAP_STYLES: BaseMapStyle[] = [
	{
		id: "positron",
		label: "Light",
		url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	},
	{
		id: "voyager",
		label: "Detailed",
		url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
	},
	{
		id: "darkMatter",
		label: "Dark",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
	},
];
