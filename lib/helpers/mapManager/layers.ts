import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { PointTooltip } from "@/lib/types/custom";

type LayerVisibility = MapOptions["visibility"];

/** A coloured fill joined to the currently selected boundary geometry. */
export type BoundaryFillLayer = {
	kind: "boundary-fill";
	data: BoundaryGeojson;
	colorExpression: unknown[];
	visibility: LayerVisibility;
};

/** A collection of independently positioned markers. */
export type PointLayer = {
	kind: "points";
	data: GeoJSON.FeatureCollection;
	visibility: LayerVisibility;
	radius?: { min: number; max: number };
	tooltip?: PointTooltip;
	isDark?: boolean;
};

/**
 * A standalone path layer, suitable for roads, railways, routes, or flows.
 * `id` namespaces its MapLibre source and layer, allowing several networks to
 * coexist once a dataset supplies line geometry.
 */
export type LineLayer = {
	kind: "line";
	id: string;
	data: GeoJSON.FeatureCollection;
	visibility: LayerVisibility;
	style: {
		color: string | unknown[];
		width: number | unknown[];
		opacity?: number;
	};
};

export type MapLayer = BoundaryFillLayer | PointLayer | LineLayer;
