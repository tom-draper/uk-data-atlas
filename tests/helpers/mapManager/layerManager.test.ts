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
		setFilter: vi.fn(),
		sources,
	};
}

describe("LayerManager visibility updates", () => {
	it("uses the configured marker size for a point dataset", () => {
		const map = createMap();
		const manager = new LayerManager(map as any);
		const visibility = {
			hideDataLayer: false,
			hideBorders: false,
			hideBoundaryLayer: false,
			hideOverlay: false,
			overlayOpacity: 0.6,
		};

		manager.render({
			kind: "points",
			data: { type: "FeatureCollection", features: [] },
			visibility,
			radius: { min: 1.5, max: 3.5 },
		});

		expect(map.setPaintProperty).toHaveBeenCalledWith(
			"custom-points-circle",
			"circle-radius",
			["interpolate", ["linear"], ["zoom"], 6, 1.5, 10, 3.5],
		);
	});

	it("renders standalone line layers through the shared layer contract", () => {
		const map = createMap();
		const manager = new LayerManager(map as any);
		manager.render({
			kind: "line",
			id: "rail-network",
			data: { type: "FeatureCollection", features: [] },
			visibility: {
				hideDataLayer: false,
				hideBorders: false,
				hideBoundaryLayer: false,
				hideOverlay: false,
				overlayOpacity: 0.6,
			},
			style: { color: "#d4006a", width: 2, opacity: 0.8 },
		});

		expect(map.getLayer("atlas-line-rail-network-stroke")).toBeDefined();
		expect(map.setPaintProperty).toHaveBeenCalledWith(
			"atlas-line-rail-network-stroke",
			"line-opacity",
			0.8,
		);
	});

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

	it("renders vector-tile line layers without loading national GeoJSON", () => {
		const map = createMap();
		const manager = new LayerManager(map as any);
		manager.render({
			kind: "vector-line",
			id: "os-open-roads",
			source: {
				tiles: ["https://tiles.example/{z}/{x}/{y}.pbf"],
				sourceLayer: "RoadLink",
			},
			visibility: {
				hideDataLayer: false,
				hideBorders: false,
				hideBoundaryLayer: false,
				hideOverlay: false,
				overlayOpacity: 0.6,
			},
			style: { color: "#c2410c", width: 1 },
		});

		expect(map.getLayer("atlas-vector-line-os-open-roads-stroke")).toBeDefined();
	});

	it("does not re-upload numeric GeoJSON when only the colour expression changes", () => {
		const map = createMap();
		const manager = new LayerManager(map as any);
		const geojson = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "CRS84" } },
			features: [],
		} as any;
		const visibility = {
			hideDataLayer: false,
			hideBorders: false,
			hideBoundaryLayer: false,
			hideOverlay: false,
			overlayOpacity: 0.6,
		};

		manager.updateValueLayers(geojson, ["get", "value"], visibility);
		const setData = map.sources.get("location-wards")!.setData;

		manager.updateValueLayers(
			geojson,
			["interpolate", ["linear"], ["get", "value"], 0, "#000", 1, "#fff"],
			visibility,
		);

		expect(setData).not.toHaveBeenCalled();
		expect(map.setPaintProperty).toHaveBeenCalledWith(
			"wards-fill",
			"fill-color",
			["interpolate", ["linear"], ["get", "value"], 0, "#000", 1, "#fff"],
		);
	});
});
