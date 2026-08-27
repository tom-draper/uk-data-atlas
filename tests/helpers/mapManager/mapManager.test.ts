import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";

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
		getCanvas: () => ({ style: { cursor: "" } }),
		on: vi.fn(),
		off: vi.fn(),
		setFeatureState: vi.fn(),
		sources,
	};
}

describe("MapManager election updates", () => {
	it("reuses the active percentage source when only the range changes", () => {
		const map = createMap();
		const manager = new MapManager(map as any, { onLocationChange: () => {} });
		const dataset = {
			id: "test-election",
			type: "localElection",
			year: 2025,
			boundaryType: "ward",
			boundaryYear: 2024,
			data: { W0001: { partyVotes: { LAB: 100, CON: 50 } } },
			results: { W0001: "LAB" },
			partyInfo: [
				{ key: "LAB", name: "Labour" },
				{ key: "CON", name: "Conservative" },
			],
		} as any;
		const geojson = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "CRS84" } },
			features: [
				{
					type: "Feature",
					id: 1,
					properties: { WD24CD: "W0001", WD24NM: "Test ward" },
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
		const options = {
			...DEFAULT_MAP_OPTIONS,
			localElection: {
				mode: "percentage" as const,
				selected: "LAB",
				percentageRange: { min: 0, max: 100 },
			},
		};
		const builder = (manager as any).featureBuilder;
		const buildPercentage = vi.spyOn(builder, "buildElectionPercentageFeatures");

		manager.updateMapForLocalElection(geojson, dataset, options);
		manager.updateMapForLocalElection(geojson, dataset, {
			...options,
			localElection: {
				...options.localElection,
				percentageRange: { min: 25, max: 75 },
			},
		});

		expect(buildPercentage).toHaveBeenCalledTimes(1);
		expect(map.sources.get("location-wards")!.setData).not.toHaveBeenCalled();
	});
});
