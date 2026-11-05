import { describe, expect, it } from "vitest";
import {
	GEOMETRY_DECIMALS,
	packGeometry,
	packText,
	roundGeometry,
	unpackGeometry,
	unpackText,
} from "@uk-data-atlas/atlas-runtime/storage";

describe("stored payload text", () => {
	it("round-trips text exactly, including multi-byte characters", () => {
		const text = JSON.stringify({ name: "Ynys Môn", rows: [1, 2.5, null] });
		expect(unpackText(packText(text))).toBe(text);
	});

	it("shrinks repetitive JSON and stores the same bytes every time", () => {
		const text = JSON.stringify(
			Array.from({ length: 2000 }, (_, id) => ({ id, kind: "path" })),
		);
		const packed = packText(text);
		expect(packed.length).toBeLessThan(text.length / 10);
		expect(packText(text).equals(packed)).toBe(true);
	});

	it("reads plain text as it is and rejects other values", () => {
		expect(unpackText("plain")).toBe("plain");
		expect(unpackText(undefined)).toBeUndefined();
		expect(unpackText(null)).toBeUndefined();
		expect(unpackText(4)).toBeUndefined();
	});
});

describe("stored geometry", () => {
	const ring = (x: number, y: number, size: number) => [
		[x, y],
		[x + size, y],
		[x + size, y + size],
		[x, y + size],
		[x, y],
	];

	it("rounds coordinates to about a metre", () => {
		expect(GEOMETRY_DECIMALS).toBe(5);
		const geometry = roundGeometry({
			type: "MultiPolygon",
			coordinates: [[ring(-1.234567891, 51.987654321, 0.1)]],
		});
		expect(geometry.coordinates).toEqual([
			[
				[
					[-1.23457, 51.98765],
					[-1.13457, 51.98765],
					[-1.13457, 52.08765],
					[-1.23457, 52.08765],
					[-1.23457, 51.98765],
				],
			],
		]);
	});

	it("merges points that round together and drops collapsed rings", () => {
		const geometry = roundGeometry({
			type: "MultiPolygon",
			coordinates: [
				[
					[
						[0, 0],
						[0.000001, 0.000001],
						[0.1, 0],
						[0.1, 0.1],
						[0, 0],
					],
					// A hole too small to survive.
					ring(0.05, 0.02, 0.0000001),
				],
				// A polygon too small to survive.
				[ring(0.5, 0.5, 0.000001)],
			],
		});
		expect(geometry.coordinates).toEqual([
			[
				[
					[0, 0],
					[0.1, 0],
					[0.1, 0.1],
					[0, 0],
				],
			],
		]);
	});

	it("rounds each part of a collection and plain positions", () => {
		const geometry = roundGeometry({
			type: "GeometryCollection",
			geometries: [
				{ type: "Point", coordinates: [1.0000049, 2.0000051] },
			],
		});
		expect(geometry.geometries).toEqual([
			{ type: "Point", coordinates: [1, 2.00001] },
		]);
	});

	it("stores the rounded shape with bounds measured from it", () => {
		const { geometry, bbox } = packGeometry({
			type: "MultiPolygon",
			coordinates: [[ring(-1.2345678, 51.1234567, 0.5)]],
		});
		expect(bbox).toEqual([-1.23457, 51.12346, -0.73457, 51.62346]);
		const stored = unpackGeometry(geometry);
		expect(stored.type).toBe("MultiPolygon");
		expect(JSON.stringify(stored)).toContain("[-1.23457,51.12346]");
	});

	it("reads geometry stored as plain JSON text", () => {
		const text = JSON.stringify({ type: "Point", coordinates: [1, 2] });
		expect(unpackGeometry(text)).toEqual({
			type: "Point",
			coordinates: [1, 2],
		});
		expect(() => unpackGeometry(null)).toThrow("Invalid stored geometry");
	});
});
