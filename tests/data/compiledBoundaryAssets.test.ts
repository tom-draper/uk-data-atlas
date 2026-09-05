import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import { getProp } from "@/lib/data/boundaries/properties";

const localBoundaryPath = (path: string) =>
	join(process.cwd(), "data", path.replace(/^\/data\//, ""));

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

			const coordinates = firstFeature.geometry.coordinates
				.flat(Infinity)
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
