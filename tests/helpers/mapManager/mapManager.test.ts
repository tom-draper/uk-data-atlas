import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { childPovertyDefinition } from "@/lib/datasets/childPoverty";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import {
	renderLocalElection,
	renderNumericDataset,
} from "@/lib/helpers/mapRendering";

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
		getCanvas: () => ({ style: { cursor: "" } }),
		on: vi.fn(),
		off: vi.fn(),
		setFeatureState: vi.fn(),
		sources,
	};
}

describe("MapManager election updates", () => {
	it("activates a vector network without retaining boundary data", () => {
		const map = createMap();
		const manager = new MapManager(map as any, { onLocationChange: () => {} });
		const boundarySource = { setData: vi.fn() };
		map.sources.set("location-wards", boundarySource);

		manager.updateVectorLineLayer({
			kind: "vector-line",
			id: "os-open-roads",
			source: {
				tiles: ["https://tiles.example/{z}/{x}/{y}.pbf"],
				sourceLayer: "RoadLink",
			},
			visibility: DEFAULT_MAP_OPTIONS.visibility,
			style: { color: "#c2410c", width: 1 },
		});

		expect(map.getLayer("atlas-vector-line-os-open-roads-stroke")).toBeDefined();
		expect(boundarySource.setData).toHaveBeenCalled();
	});

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
				colorRange: { min: 0, max: 1 },
			},
		};
		const builder = manager.featureBuilder;
		const buildPercentage = vi.spyOn(builder, "buildElectionPercentageFeatures");

		renderLocalElection(manager, geojson, dataset, options);
		renderLocalElection(manager, geojson, dataset, {
			...options,
			localElection: {
				...options.localElection,
				percentageRange: { min: 25, max: 75 },
			},
		});

		expect(buildPercentage).toHaveBeenCalledTimes(1);
		expect(map.sources.get("location-wards")!.setData).not.toHaveBeenCalled();
	});

	it("renders registry-backed numeric datasets through the shared value path", () => {
		const map = createMap();
		const manager = new MapManager(map as any, { onLocationChange: () => {} });
		const dataset = {
			id: "child-poverty-2025",
			type: "childPoverty" as const,
			year: 2025,
			measure: "relativeLowIncomeBeforeHousingCosts" as const,
			boundaryType: "localAuthority" as const,
			boundaryYear: 2025,
			data: {
				E06000001: {
					ladCode: "E06000001",
					ladName: "Test authority",
					childCount: 25,
					childrenPopulation: 100,
					childPovertyRate: 25,
				},
			},
		};
		const geojson = {
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "CRS84" } },
			features: [
				{
					type: "Feature",
					id: 1,
					properties: { LAD25CD: "E06000001", LAD25NM: "Test authority" },
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
		const builder = manager.featureBuilder;
		const buildValue = vi.spyOn(builder, "buildValueFeatures");

		renderNumericDataset(
			manager,
			geojson,
			dataset,
			DEFAULT_MAP_OPTIONS,
			childPovertyDefinition.map!,
		);
		renderNumericDataset(
			manager,
			geojson,
			dataset,
			{
				...DEFAULT_MAP_OPTIONS,
				childPoverty: { colorRange: { min: 10, max: 30 } },
			},
			childPovertyDefinition.map!,
		);

		expect(buildValue).toHaveBeenCalledTimes(1);
		const valueFor = buildValue.mock.calls[0][2] as (code: string) => number | null;
		expect(valueFor("E06000001")).toBe(25);
	});
});
