import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import { getProp } from "@/lib/data/boundaries/properties";

const localBoundaryPath = (path: string) =>
	join(process.cwd(), "data", path.replace(/^\/data\//, ""));

describe("compiled ward boundary assets", () => {
	it("serves old ward vintages as WGS84 TopoJSON", () => {
		for (const year of [2016, 2017, 2018, 2019] as const) {
			const path = BOUNDARY_CATALOG.ward.vintages[year];
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
	});
});
