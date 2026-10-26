import { afterEach, describe, expect, it, vi } from "vitest";
import { pmtilesURL } from "@/lib/map/tilesUrl";
import { boundaryArchiveAsset } from "@/lib/data/boundaries/catalog";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	parseBoundaryTilesManifest,
	selectBoundaryTiles,
} from "@/lib/data/boundaries/tiles";

const release = "ward/2026-05-uk-bgc";
const href = `/data/boundaries/${release}/boundaries.pmtiles`;
const json = {
	schemaVersion: 2,
	minZoom: 0,
	maxZoom: 12,
	releases: { [release]: { method: "shared-arcs", href, bytes: 1024 } },
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("boundary map resources", () => {
	it("fetches only the manifest and properties, deriving ids before location filtering", async () => {
		const { fetchMapBoundaries, boundaryTiles } =
			await import("@/lib/data/boundaries/tiles");
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
		expect(first.features.map((feature) => feature.geometry)).toEqual([
			null,
			null,
			null,
		]);
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

	it("selects tiles for coarse boundary families too", () => {
		const path = BOUNDARY_CATALOG.localAuthority.vintages[2024]!;
		const key = `localAuthority/${BOUNDARY_CATALOG.localAuthority.releases.find((r) => r.asset === path)!.id}`;
		const href = path.replace(".topojson", ".pmtiles");
		const manifest = parseBoundaryTilesManifest({
			...json,
			releases: { [key]: { method: "shared-arcs", href, bytes: 20 } },
		});
		expect(selectBoundaryTiles(manifest, "localAuthority", path)).toEqual({
			href,
			minZoom: 0,
			maxZoom: 12,
			codeKey: "LAD24CD",
		});
	});

	it.each([
		["dataZone", 2011],
		["superOutputArea", 2011],
		["lsoa", 2001],
		["ward", 2017],
	] as const)(
		"loads %s %s through properties and tiles only",
		async (type, year) => {
			const { fetchMapBoundaries, boundaryTiles } =
				await import("@/lib/data/boundaries/tiles");
			const family = BOUNDARY_CATALOG[type];
			const path = Object.entries(family.vintages).find(
				([key]) => Number(key) === year,
			)![1];
			const release = family.releases.find(
				(release) => release.asset === path,
			)!;
			const fetcher = vi.fn(async (url: string) => {
				if (url.endsWith("tiles.json"))
					return Response.json({
						...json,
						releases: {
							[`${type}/${release.id}`]: {
								method: "shared-arcs",
								href: path,
								bytes: 100,
							},
						},
					});
				if (url.endsWith("properties.json"))
					return Response.json({
						features: [{ [release.codeKey]: "area-one" }],
					});
				throw new Error(`Unexpected geometry request: ${url}`);
			});
			vi.stubGlobal("fetch", fetcher);
			const data = await fetchMapBoundaries(path, {
				type,
				location: null,
			});
			expect(data.features).toHaveLength(1);
			expect(data.features[0]?.geometry).toBeNull();
			expect(boundaryTiles.get(data)?.href).toBe(path);
			expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
				"/data/boundaries/tiles.json",
				path.replace("boundaries.pmtiles", "properties.json"),
			]);
		},
	);

	it("selects the same tile path for a compiled-polygon exception", () => {
		const path = BOUNDARY_CATALOG.ward.vintages[2017]!;
		const href = path.replace(".topojson", ".pmtiles");
		const manifest = parseBoundaryTilesManifest({
			...json,
			releases: {
				"ward/2017-12-gb-bgc": {
					method: "compiled-polygons",
					href,
					bytes: 200,
					reason: "not a coverage",
				},
			},
		});
		expect(selectBoundaryTiles(manifest, "ward", path)).toEqual({
			href,
			minZoom: 0,
			maxZoom: 12,
			codeKey: "wd17cd",
		});
	});

	it("fails on a missing release instead of fetching TopoJSON", async () => {
		const { fetchMapBoundaries } =
			await import("@/lib/data/boundaries/tiles");
		const fetcher = vi.fn(async () => Response.json(json));
		vi.stubGlobal("fetch", fetcher);
		await expect(
			fetchMapBoundaries(BOUNDARY_CATALOG.ward.vintages[2017]!, {
				type: "ward",
				location: null,
			}),
		).rejects.toThrow("Missing boundary map resource");
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("retries a failed manifest request without falling back to geometry", async () => {
		const { fetchMapBoundaries } =
			await import("@/lib/data/boundaries/tiles");
		const fetcher = vi.fn(
			async () => new Response("missing", { status: 404 }),
		);
		vi.stubGlobal("fetch", fetcher);
		const filter = { type: "ward", location: null } as const;
		for (let i = 0; i < 2; i++)
			await expect(
				fetchMapBoundaries(
					BOUNDARY_CATALOG.ward.vintages[2026]!,
					filter,
				),
			).rejects.toThrow("Boundary map manifest: 404");
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it.each([
		null,
		{},
		{ ...json, schemaVersion: 1 },
		{ ...json, minZoom: -1 },
		{ ...json, maxZoom: 0.5 },
		{ ...json, maxZoom: -1 },
		{
			...json,
			releases: {
				[release]: {
					method: "shared-arcs",
					href: "https://example.com/tiles",
					bytes: 1,
				},
			},
		},
		{
			...json,
			releases: { [release]: { method: "shared-arcs", href, bytes: 0 } },
		},
		{
			...json,
			releases: { [release]: { method: "topojson", href, bytes: 1 } },
		},
		{
			...json,
			releases: {
				[release]: {
					method: "compiled-polygons",
					href: href,
					bytes: 1,
				},
			},
		},
	])("rejects malformed manifests: %j", (value) =>
		expect(() => parseBoundaryTilesManifest(value)).toThrow(),
	);
});

it("preserves a validated archive hash through CDN and PMTiles URL construction", () => {
	vi.stubEnv("NODE_ENV", "production");
	vi.stubEnv("NEXT_PUBLIC_DATA_VERSION", "unrelated-build");
	vi.stubEnv("NEXT_PUBLIC_DATA_BASE_URL", "");
	const hashed = `/data/boundaries/${release}/${"a".repeat(64)}.pmtiles`;
	const manifest = parseBoundaryTilesManifest({
		...json,
		releases: {
			[release]: { method: "shared-arcs", href: hashed, bytes: 1024 },
		},
	});
	const selected = selectBoundaryTiles(
		manifest,
		"ward",
		BOUNDARY_CATALOG.ward.vintages[2026]!,
	);
	expect(selected.href).toBe(hashed);
	expect(pmtilesURL(selected.href, "https://example.com/maps")).toBe(
		`pmtiles://https://example.com${hashed}`,
	);
	vi.stubEnv("NEXT_PUBLIC_DATA_BASE_URL", "https://cdn.example.com");
	expect(boundaryArchiveAsset(hashed)).toBe(
		`https://cdn.example.com${hashed}`,
	);
});
it.each(["../bad", "a".repeat(63), "A".repeat(64), "a".repeat(64) + "/extra"])(
	"rejects invalid content hashes %s",
	(hash) => {
		expect(() =>
			parseBoundaryTilesManifest({
				...json,
				releases: {
					[release]: {
						method: "shared-arcs",
						href: `/data/boundaries/${release}/${hash}.pmtiles`,
						bytes: 1024,
					},
				},
			}),
		).toThrow();
	},
);
