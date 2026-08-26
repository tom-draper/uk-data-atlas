import { describe, expect, it, vi } from "vitest";
import { LayerManager } from "@/lib/helpers/mapManager/layerManager";

function createMap() {
	const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
	const layers = new Set<string>();

	return {
		isStyleLoaded: () => true,
		getSource: (id: string) => sources.get(id),
		getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
		addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
		addLayer: ({ id }: { id: string }) => layers.add(id),
		removeLayer: (id: string) => layers.delete(id),
		removeSource: (id: string) => sources.delete(id),
		setPaintProperty: vi.fn(),
		sources,
	};
}

describe("LayerManager visibility updates", () => {
	it("does not re-upload boundary GeoJSON when only visibility changes", () => {
		const map = createMap();
		const manager = new LayerManager(map as any);
		const geojson = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "CRS84" } },
			features: [
				{
					type: "Feature",
					properties: { color: "#ff0000" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[0, 0],
								[1, 0],
								[0, 1],
								[0, 0],
							],
						],
					},
				},
			],
		} as any;

		manager.updateColoredLayers(geojson, {
			hideDataLayer: false,
			hideBorders: false,
			hideBoundaryLayer: false,
			hideOverlay: false,
			overlayOpacity: 0.6,
		});
		const setData = map.sources.get("location-wards")!.setData;

		manager.updateVisibility({
			hideDataLayer: true,
			hideBorders: true,
			hideBoundaryLayer: false,
			hideOverlay: false,
			overlayOpacity: 0.4,
		});

		expect(setData).not.toHaveBeenCalled();
		expect(map.setPaintProperty).toHaveBeenCalledWith(
			"wards-fill",
			"fill-opacity",
			0.4,
		);
		expect(map.setPaintProperty).toHaveBeenCalledWith(
			"wards-line",
			"line-opacity",
			0,
		);
	});
});
