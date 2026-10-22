import { afterEach, describe, expect, it, vi } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	boundaryTiles,
	fetchMapBoundaries,
	parseBoundaryTilesManifest,
	selectBoundaryTiles,
} from "@/lib/data/boundaries/tiles";

const release = "ward/2026-05-uk-bgc";
const href = `/data/boundaries/${release}/boundaries.pmtiles`;
const json = {
	minZoom: 0,
	maxZoom: 12,
	releases: { [release]: { href, bytes: 1024 } },
	untiled: { "ward/2017-12-gb-bgc": "not a coverage" },
};

afterEach(() => vi.unstubAllGlobals());

describe("boundary tile source selection", () => {
	it("fetches the manifest once and derives ids from the full property sidecar without geometry", async () => {
		const fetcher = vi.fn(async (path: string) => {
			if (path === "/data/boundaries/tiles.json")
				return Response.json(json);
			if (path.endsWith("/properties.json"))
				return Response.json({
					features: [
						{ WD26CD: "E003" },
						{ WD26CD: "E001" },
						{ WD26CD: "E002" },
					],
				});
			throw new Error(`Unexpected geometry request: ${path}`);
		});
		vi.stubGlobal("fetch", fetcher);
		const path = BOUNDARY_CATALOG.ward.vintages[2026]!;
		const [first, second] = await Promise.all([
			fetchMapBoundaries(path, { type: "ward", location: null }),
			fetchMapBoundaries(path, { type: "ward", location: "England" }),
		]);
		expect(
			first.features.every((feature) => feature.geometry === null),
		).toBe(true);
		expect(second.features).toHaveLength(3);
		expect([...boundaryTiles.get(first)!.ids]).toEqual([
			["E001", 1],
			["E002", 2],
			["E003", 3],
		]);
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
			"/data/boundaries/tiles.json",
			"/data/boundaries/ward/2026-05-uk-bgc/properties.json",
		]);
	});

	it("selects only compiled releases, preserving catalogue property keys", () => {
		const manifest = parseBoundaryTilesManifest(json);
		expect(
			selectBoundaryTiles(
				manifest,
				"ward",
				BOUNDARY_CATALOG.ward.vintages[2026]!,
			),
		).toEqual({ href, minZoom: 0, maxZoom: 12, codeKey: "WD26CD" });
		expect(
			selectBoundaryTiles(
				manifest,
				"ward",
				BOUNDARY_CATALOG.ward.vintages[2017]!,
			),
		).toBeNull();
		expect(
			selectBoundaryTiles(
				manifest,
				"localAuthority",
				BOUNDARY_CATALOG.localAuthority.vintages[2024]!,
			),
		).toBeNull();
		expect(
			selectBoundaryTiles(
				null,
				"ward",
				BOUNDARY_CATALOG.ward.vintages[2026]!,
			),
		).toBeNull();
	});
	it.each([
		null,
		{},
		{ ...json, minZoom: -1 },
		{ ...json, maxZoom: 0.5 },
		{ ...json, maxZoom: -1 },
		{
			...json,
			releases: {
				[release]: { href: "https://example.com/tiles", bytes: 1 },
			},
		},
		{ ...json, releases: { [release]: { href, bytes: 0 } } },
		{ ...json, untiled: { [release]: "not a coverage" } },
	])("rejects malformed manifests: %j", (value) => {
		expect(() => parseBoundaryTilesManifest(value)).toThrow();
	});
});
