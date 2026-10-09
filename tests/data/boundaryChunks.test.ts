import { afterEach, describe, expect, it, vi } from "vitest";
import {
	boundaryChunkRegions,
	boundaryChunkUrl,
	fetchBoundaryGeometry,
	mergeBoundaryChunks,
} from "@/lib/data/boundaries/chunks";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import type { BoundaryGeojson } from "@/lib/types";
import { subsetTopology } from "../../scripts/boundary-chunks";

// Three squares in a row, so the first and second share an arc, and the
// second and third share another. Arc 1 is walked backwards by one of them.
const topology = {
	type: "Topology" as const,
	transform: { scale: [1, 1], translate: [0, 0] },
	objects: {
		ward: {
			type: "GeometryCollection",
			geometries: [
				{
					type: "Polygon",
					arcs: [[0, 1]],
					id: 1,
					properties: { a: 1 },
				},
				{ type: "Polygon", arcs: [[~1, 2]], properties: { a: 2 } },
				{
					type: "Polygon",
					arcs: [[~2, 3]],
					id: 3,
					properties: { a: 3 },
				},
			],
		},
	},
	arcs: [
		[
			[0, 0],
			[0, 1],
		],
		[
			[1, 0],
			[1, 1],
		],
		[
			[2, 0],
			[2, 1],
		],
		[
			[3, 0],
			[3, 1],
		],
	],
};

const features = (json: unknown) =>
	decodeBoundaryData(json).features.map((feature) => ({
		id: feature.id,
		properties: feature.properties,
		geometry: feature.geometry,
	}));

describe("subsetTopology", () => {
	it("decodes each kept feature exactly as the whole topology does", () => {
		const whole = features(topology);
		const kept = subsetTopology(
			topology,
			"ward",
			(_, index) => index !== 0,
		);
		expect(features(kept)).toEqual(whole.slice(1));
	});

	it("keeps only the arcs the kept features use", () => {
		const kept = subsetTopology(
			topology,
			"ward",
			(_, index) => index === 2,
		);
		expect(kept.arcs).toEqual([topology.arcs[2], topology.arcs[3]]);
	});

	it("gives a feature without an id the one the decoder would", () => {
		const kept = subsetTopology(
			topology,
			"ward",
			(_, index) => index === 1,
		);
		expect(features(kept).map(({ id }) => id)).toEqual([2]);
	});

	it("leaves the transform and the input untouched", () => {
		const before = JSON.stringify(topology);
		const kept = subsetTopology(topology, "ward", () => true);
		expect(kept.transform).toEqual(topology.transform);
		expect(JSON.stringify(topology)).toBe(before);
	});

	it("can hold no features", () => {
		const kept = subsetTopology(topology, "ward", () => false);
		expect(kept.arcs).toEqual([]);
		expect(features(kept)).toEqual([]);
	});
});

describe("boundaryChunkRegions", () => {
	it("names the one region a council sits in", () => {
		expect(
			boundaryChunkRegions("ward", "Greater Manchester", true),
		).toEqual(["E12000002"]);
	});

	it("reads the whole release for families that are not chunked", () => {
		expect(
			boundaryChunkRegions("constituency", "Greater Manchester", true),
		).toBeNull();
	});

	it("reads the whole release for a country, no location, or an unknown one", () => {
		for (const location of ["England", "United Kingdom", null, "Nowhere"])
			expect(boundaryChunkRegions("ward", location, true)).toBeNull();
	});

	it("reads LSOAs whole without the lookup that places them", () => {
		expect(
			boundaryChunkRegions("lsoa", "Greater Manchester", false),
		).toBeNull();
		expect(
			boundaryChunkRegions("lsoa", "Greater Manchester", true),
		).not.toBeNull();
	});
});

describe("boundaryChunkUrl", () => {
	it("serves a chunk beside its release and keeps the version query", () => {
		expect(
			boundaryChunkUrl(
				"/data/boundaries/ward/2025-12-uk-bgc/boundaries.topojson?v=abc",
				"E12000002",
			),
		).toBe(
			"/data/boundaries/ward/2025-12-uk-bgc/chunks/E12000002.topojson?v=abc",
		);
	});
});

describe("mergeBoundaryChunks", () => {
	it("restores the order of the whole release", () => {
		const chunk = (...ids: number[]) =>
			({
				type: "FeatureCollection",
				features: ids.map((id) => ({ id, properties: {} })),
			}) as unknown as BoundaryGeojson;
		expect(
			mergeBoundaryChunks([chunk(2, 5), chunk(1, 4)]).features.map(
				({ id }) => id,
			),
		).toEqual([1, 2, 4, 5]);
	});
});

describe("fetchBoundaryGeometry", () => {
	afterEach(() => vi.unstubAllGlobals());

	const serve = (files: Record<string, unknown>) => {
		const requested: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => {
			requested.push(url);
			return url in files
				? { ok: true, json: async () => files[url] }
				: { ok: false, status: 404, statusText: "Not Found" };
		});
		return requested;
	};

	const asset = "/data/boundaries/ward/x/boundaries.topojson";
	const chunk = (index: number) =>
		subsetTopology(topology, "ward", (_, at) => at === index);

	it("reads just the chunks it is given", async () => {
		const requested = serve({
			[boundaryChunkUrl(asset, "E12000001")]: chunk(0),
			[boundaryChunkUrl(asset, "E12000002")]: chunk(2),
			[asset]: topology,
		});
		const data = await fetchBoundaryGeometry(asset, [
			"E12000002",
			"E12000001",
		]);
		expect(data.features.map(({ id }) => id)).toEqual([1, 3]);
		expect(requested).not.toContain(asset);
	});

	it("falls back to the whole release when a chunk cannot be read", async () => {
		const requested = serve({
			[boundaryChunkUrl(asset, "E12000001")]: chunk(0),
			[asset]: topology,
		});
		const data = await fetchBoundaryGeometry(asset, [
			"E12000001",
			"E12000002",
		]);
		expect(data.features).toHaveLength(3);
		expect(requested).toContain(asset);
	});

	it("reads the whole release when no regions are given", async () => {
		const requested = serve({ [asset]: topology });
		await fetchBoundaryGeometry(asset, null);
		expect(requested).toEqual([asset]);
	});
});
