import type { MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import { SelectedArea } from "@/lib/types/areas";

export interface MapManagerCallbacks {
	onAreaHover?: (location: SelectedArea | null) => void;
	onLocationChange: (location: string) => void;
}

/**
 * A mouse handler bound to a specific layer. MapLibre types `on`/`off` for the
 * whole map, so the per-layer overload's `features` has to be spelled out here.
 */
export type MapLayerMouseHandler = (
	event: MapMouseEvent & { features?: MapGeoJSONFeature[] },
) => void;
