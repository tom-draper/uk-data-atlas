import type { NetworkDataset } from "@/lib/types/network";
import { categoryMatch, zoomInterpolate } from "@/lib/helpers/mapManager/expressions";

/** Colours applied directly to the OS `road_classification` tile attribute. */
export const OS_OPEN_ROADS_CLASSIFICATION_COLORS = {
	Motorway: "#2563eb",
	"A Road": "#dc2626",
	"B Road": "#d97706",
} as const;

export const OS_OPEN_ROADS_OTHER_ROADS_COLOR = "#94a3b8";

/**
 * External, tile-backed transport overlays. Keeping the endpoint separate from
 * the dataset catalogue avoids shipping national geometry to every browser.
 *
 * OS Open Roads is supplied by OS as MBTiles. Serve it (or a converted tile
 * archive) behind a standard `{z}/{x}/{y}` vector-tile URL and set this value
 * in the deployment environment.
 */
const osOpenRoadsTileUrl = process.env.NEXT_PUBLIC_OS_OPEN_ROADS_TILE_URL;
const osOpenRoadsSourceLayer =
	process.env.NEXT_PUBLIC_OS_OPEN_ROADS_SOURCE_LAYER ?? "road_link";

export const NETWORK_DATASETS: Record<string, NetworkDataset> = {
	"os-open-roads": {
		id: "os-open-roads",
		type: "network",
		kind: "vector-lines",
		name: "Roads",
		year: 2026,
		dataColumn: "Roads",
		provider: "Ordnance Survey",
		licence: "Open Government Licence",
		description: "A generalised, colour-coded road network for Great Britain: motorways, A roads, B roads, and local roads.",
		available: Boolean(osOpenRoadsTileUrl),
		legend: [
			{ label: "Motorway", color: OS_OPEN_ROADS_CLASSIFICATION_COLORS.Motorway },
			{ label: "A road", color: OS_OPEN_ROADS_CLASSIFICATION_COLORS["A Road"] },
			{ label: "B road", color: OS_OPEN_ROADS_CLASSIFICATION_COLORS["B Road"] },
			{ label: "Other roads", color: OS_OPEN_ROADS_OTHER_ROADS_COLOR },
		],
		layer: osOpenRoadsTileUrl
			? {
				kind: "vector-line",
				id: "os-open-roads",
				source: {
					tiles: [osOpenRoadsTileUrl],
					sourceLayer: osOpenRoadsSourceLayer,
					minzoom: 9,
					maxzoom: 14,
					attribution: "Contains OS data © Crown copyright and database right",
				},
				style: {
					color: categoryMatch(
						"road_classification",
						Object.entries(OS_OPEN_ROADS_CLASSIFICATION_COLORS),
						OS_OPEN_ROADS_OTHER_ROADS_COLOR,
					),
					width: zoomInterpolate([
						[5, 0.4],
						[10, 1.2],
						[14, 2.5],
					]),
					opacity: 0.72,
				},
			}
			: null,
	},
};
