import { describe, expect, it, vi } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	EMPTY_BOUNDARY_DATA,
	fetchBoundaryPropertyGroup,
} from "@/lib/data/boundaries/propertyLoader";
import type { BoundaryGeojson } from "@/lib/types";

const boundary = (code: string) =>
	({
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "CRS84" } },
		features: [
			{
				type: "Feature",
				properties: { CTY25CD: code },
				geometry: null,
			},
		],
	}) as unknown as BoundaryGeojson;

describe("boundary property loader", () => {
	it("provides a null slot for every catalogued boundary vintage", () => {
		for (const [type, years] of Object.entries(EMPTY_BOUNDARY_DATA)) {
			expect(Object.keys(years).map(Number)).toEqual(
				Object.keys(
					BOUNDARY_CATALOG[type as keyof typeof BOUNDARY_CATALOG]
						.propertyVintages,
				).map(Number),
			);
			expect(Object.values(years)).toEqual(
				expect.arrayContaining([null]),
			);
		}
	});

	it("keeps successful vintage loads when another vintage fails", async () => {
		const paths = BOUNDARY_CATALOG.ward.propertyVintages;
		const [successfulYear, failedYear] = Object.keys(paths).map(Number);
		const successfulPath = paths[successfulYear as keyof typeof paths];
		const failedPath = paths[failedYear as keyof typeof paths];
		const fetchProperties = vi.fn((path: string) =>
			path === failedPath
				? Promise.reject(new Error("not found"))
				: Promise.resolve(boundary(path)),
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await fetchBoundaryPropertyGroup(
			"ward",
			fetchProperties,
		);

		expect(fetchProperties).toHaveBeenCalledTimes(
			Object.keys(paths).length,
		);
		expect(result.data[successfulYear]).toEqual(boundary(successfulPath));
		expect(result.data[failedYear]).toBeUndefined();
		expect(result.failures).toEqual([
			`Could not load ward boundaries for ${failedYear}: not found`,
		]);
		error.mockRestore();
	});
});
