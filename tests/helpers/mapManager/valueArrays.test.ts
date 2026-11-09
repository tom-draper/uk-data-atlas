import { afterEach, describe, expect, it, vi } from "vitest";
import {
	codeListId,
	orderValues,
	readMapValues,
} from "@uk-data-atlas/map-tiles/mapValues";
import { LayerManager } from "@/lib/helpers/mapManager/layerManager";
import { FeatureBuilder } from "@/lib/helpers/mapManager/featureBuilder";
import {
	VALUE_STATE,
	drawnTileState,
} from "@/lib/helpers/mapManager/tileState";
import { readFromFeatureState } from "@/lib/helpers/mapManager/expressions";
import { valuePaint } from "@/lib/helpers/mapRendering/fillPaint";
import { getSequentialColorExpression } from "@/lib/helpers/colorScale/datasetColors";
import type { BoundaryTiles } from "@/lib/data/boundaries/tiles";
import type { BoundaryGeojson } from "@lib/types";

// Five areas, listed out of code order in the sidecar the way a release is.
const sidecarCodes = [
	"E06000004",
	"E06000002",
	"E06000005",
	"E06000001",
	"E06000003",
];
const codeList = [...sidecarCodes].sort();
const ids = new Map(codeList.map((code, index) => [code, index + 1] as const));
const tiles: BoundaryTiles = {
	href: "/data/boundaries/local-authority/test/x.pmtiles",
	minZoom: 0,
	maxZoom: 12,
	codeKey: "LAD25CD",
	release: "localAuthority/test",
	codeList,
	ids,
};
const geojson = {
	type: "FeatureCollection",
	features: sidecarCodes.map((code) => ({
		type: "Feature",
		id: ids.get(code),
		properties: { LAD25CD: code },
		geometry: null,
	})),
} as unknown as BoundaryGeojson;

// A sample dataset: a zero, a missing area and one the release does not have.
const record = (value: unknown) => ({ value });
const march: Record<string, { value: unknown }> = {
	E06000001: record(10),
	E06000002: record(0),
	E06000003: record(null),
	E06000005: record(32.5),
	W06000099: record(7),
};
const april: Record<string, { value: unknown }> = {
	E06000001: record(1),
	E06000004: record(2),
	E06000005: record("12"),
};
const valueOf = (data: typeof march) => (code: string) => data[code]?.value;

function createMap() {
	const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
	const layers = new Set<string>();
	return {
		isStyleLoaded: () => true,
		once: vi.fn(),
		getSource: (id: string) => sources.get(id),
		getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
		addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
		addLayer: ({ id }: { id: string }) => layers.add(id),
		removeLayer: (id: string) => layers.delete(id),
		removeSource: (id: string) => sources.delete(id),
		setPaintProperty: vi.fn(),
		setFeatureState: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		sources,
	};
}

const visibility = {
	hideDataLayer: false,
	hideBoundaryLayer: false,
	hideBorders: false,
	overlayOpacity: 0.6,
} as never;

afterEach(() => vi.unstubAllGlobals());

describe("code-aligned values against the join they replace", () => {
	it("sets the same state on every area as the join does", () => {
		const builder = new FeatureBuilder();
		for (const data of [march, april]) {
			const joined = builder.formatBoundaryGeoJson(
				builder.buildValueFeatures(
					geojson.features,
					"LAD25CD",
					(code) => {
						const value = valueOf(data)(code);
						return typeof value === "number" &&
							Number.isFinite(value)
							? value
							: null;
					},
				),
			);
			const viaJoin = drawnTileState(joined, tiles, ["value"], {
				kind: "properties",
			});
			const viaValues = drawnTileState(geojson, tiles, ["value"], {
				kind: "values",
				values: orderValues(codeList, valueOf(data)),
			});
			expect([...viaValues]).toEqual([...viaJoin]);
		}
	});

	it("sets the one state key the colour scale reads", () => {
		const color = getSequentialColorExpression(
			{ min: 0, max: 40 },
			"default" as never,
			true,
		);
		const { properties, value } = readFromFeatureState(
			valuePaint(color).color,
		);
		expect(properties).toEqual([VALUE_STATE]);
		expect(JSON.stringify(value)).toContain('["feature-state","value"]');
	});
});

describe("drawing with code-aligned values", () => {
	const paintWith = (
		manager: LayerManager,
		values: readonly (number | null)[],
		drawn = geojson,
	) =>
		manager.paintBoundaries(
			drawn,
			valuePaint(["get", "value"]),
			visibility,
			values,
		);

	it("switches dataset by setting state, never by setting source data", () => {
		vi.stubGlobal("window", {
			location: { href: "http://localhost:3000/atlas" },
		});
		const map = createMap();
		const manager = new LayerManager(map as never);
		manager.setBoundaryTiles(tiles);
		const first = orderValues(codeList, valueOf(march));
		const second = orderValues(codeList, valueOf(april));
		paintWith(manager, first);
		const setData = map.sources.get("location-wards")!.setData;
		expect(map.setFeatureState).toHaveBeenCalledWith(
			{ source: "location-wards", sourceLayer: "boundaries", id: 2 },
			{ outsideDataset: false, value: 0 },
		);
		map.setFeatureState.mockClear();
		paintWith(manager, second);
		expect(setData).not.toHaveBeenCalled();
		const states = new Map(
			map.setFeatureState.mock.calls.map(([target, state]) => [
				target.id,
				state,
			]),
		);
		expect(states.get(1)).toEqual({ outsideDataset: false, value: 1 });
		expect(states.get(2)).toEqual({ outsideDataset: false, value: null });
		expect(states.get(4)).toEqual({ outsideDataset: false, value: 2 });
		// Hover has its own key, which a value update never writes.
		for (const [, state] of map.setFeatureState.mock.calls)
			expect(Object.keys(state)).not.toContain("hover");
	});

	it("does not set state again for the same values", () => {
		vi.stubGlobal("window", {
			location: { href: "http://localhost:3000/atlas" },
		});
		const map = createMap();
		const manager = new LayerManager(map as never);
		manager.setBoundaryTiles(tiles);
		const values = orderValues(codeList, valueOf(march));
		paintWith(manager, values);
		map.setFeatureState.mockClear();
		paintWith(manager, values);
		expect(map.setFeatureState).not.toHaveBeenCalled();
	});

	it("hides the areas the drawn collection leaves out", () => {
		vi.stubGlobal("window", {
			location: { href: "http://localhost:3000/atlas" },
		});
		const map = createMap();
		const manager = new LayerManager(map as never);
		manager.setBoundaryTiles(tiles);
		const subset = {
			...geojson,
			features: geojson.features.slice(0, 2),
		} as BoundaryGeojson;
		paintWith(manager, orderValues(codeList, valueOf(march)), subset);
		const hidden = map.setFeatureState.mock.calls.filter(
			([, state]) => state.outsideDataset === true,
		);
		expect(hidden).toHaveLength(3);
	});

	it("refuses values made for a different number of areas", () => {
		vi.stubGlobal("window", {
			location: { href: "http://localhost:3000/atlas" },
		});
		const manager = new LayerManager(createMap() as never);
		manager.setBoundaryTiles(tiles);
		expect(() => paintWith(manager, [1, 2, 3])).toThrow(
			/entries for 5 areas/,
		);
	});
});

describe("reading values against the tiles' code list", () => {
	it("rejects an entry made for a different code list", () => {
		const entry = {
			file: "x.json",
			field: "value",
			bytes: 0,
			sha256: "",
			codeList: codeListId([...codeList].reverse()),
			valueCount: 0,
		};
		expect(() =>
			readMapValues("[1,2,3,4,5]", entry, codeListId(tiles.codeList)),
		).toThrow(/code list/);
	});
});
