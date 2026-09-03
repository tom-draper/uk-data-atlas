import type { NetworkDataset } from "@/lib/types/network";
import { zoomInterpolate } from "@/lib/helpers/mapManager/expressions";

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
	process.env.NEXT_PUBLIC_OS_OPEN_ROADS_SOURCE_LAYER ?? "RoadLink";

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
		description: "A generalised road network for Great Britain, from motorways to country lanes.",
		available: Boolean(osOpenRoadsTileUrl),
		layer: osOpenRoadsTileUrl
			? {
				kind: "vector-line",
				id: "os-open-roads",
				source: {
					tiles: [osOpenRoadsTileUrl],
					sourceLayer: osOpenRoadsSourceLayer,
					minzoom: 5,
					maxzoom: 14,
					attribution: "Contains OS data © Crown copyright and database right",
				},
				style: {
					color: "#c2410c",
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
