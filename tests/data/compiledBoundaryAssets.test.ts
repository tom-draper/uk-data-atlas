import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import { getProp } from "@/lib/data/boundaries/properties";

/**
 * Compiled assets live in public/data, where they are served from; the two
 * releases published as TopoJSON are committed in data/. Look in both.
 */
const localBoundaryPath = (path: string) => {
	const relative = path.split("?")[0]!.replace(/^\/data\//, "");
	const served = join(process.cwd(), "public", "data", relative);
	return existsSync(served) ? served : join(process.cwd(), "data", relative);
};

const WARD_VINTAGES = Object.keys(BOUNDARY_CATALOG.ward.vintages).map(Number);

describe("compiled ward boundary assets", () => {
	it("covers every ward vintage the catalogue serves", () => {
		expect(WARD_VINTAGES.length).toBeGreaterThanOrEqual(9);
	});

	it("serves every ward vintage as WGS84 TopoJSON", () => {
		for (const year of WARD_VINTAGES) {
			const path =
				BOUNDARY_CATALOG.ward.vintages[
					year as keyof typeof BOUNDARY_CATALOG.ward.vintages
				];
			expect(path).toMatch(/\.topojson$/);

			const topology = JSON.parse(
				readFileSync(localBoundaryPath(path), "utf8"),
			) as unknown;
			expect(topology).toMatchObject({ type: "Topology" });

			const boundaries = decodeBoundaryData(topology);
			expect(boundaries.features.length).toBeGreaterThan(1_000);
			const firstFeature = boundaries.features[0]!;
			expect(
				getProp(
					firstFeature.properties,
					BOUNDARY_CATALOG.ward.properties.code,
				),
			).toMatch(/^[EW]05/);

			const coordinates = firstFeature
				.geometry!.coordinates.flat(Infinity)
				.filter((value): value is number => typeof value === "number");
			expect(coordinates.some((value) => Math.abs(value) < 10)).toBe(
				true,
			);
			expect(coordinates.some((value) => value > 49 && value < 61)).toBe(
				true,
			);
		}
	}, 60_000);
});

describe("every compiled boundary release", () => {
	const releases = Object.entries(BOUNDARY_CATALOG)
		.flatMap(([type, family]) =>
			family.releases.flatMap((release) =>
				release.asset
					? [
							{
								label: `${type}/${release.id}`,
								path: localBoundaryPath(release.asset),
							},
						]
					: [],
			),
		)
		.filter(({ path }) => existsSync(path));

	// The map keys hover state by feature id. May 2026 local authorities, May
	// 2025 parishes and 2011 data zones were published without one, and none of
	// their areas could be hovered.
	it.each(releases)(
		"gives every feature of $label an id the map can hover",
		({ path }) => {
			const ids = decodeBoundaryData(
				JSON.parse(readFileSync(path, "utf8")),
			).features.map((feature) => feature.id);
			expect(ids.filter((id) => id === undefined)).toEqual([]);
			expect(new Set(ids).size).toBe(ids.length);
		},
	);
});
