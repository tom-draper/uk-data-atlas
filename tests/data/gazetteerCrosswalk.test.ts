import { describe, expect, it } from "vitest";
import { buildCrosswalk } from "@/lib/data/gazetteer/build";

const square = (code: string, x0: number, y0: number, size: number) => ({
	type: "Feature" as const,
	properties: { CODE: code },
	geometry: {
		type: "Polygon" as const,
		coordinates: [
			[
				[x0, y0],
				[x0 + size, y0],
				[x0 + size, y0 + size],
				[x0, y0 + size],
				[x0, y0],
			],
		],
	},
});

describe("buildCrosswalk", () => {
	// One source split between two targets: a large, thinly populated block
	// in T1 and a small, crowded one in T2.
	const sources = [square("S", 0, 0, 1)];
	const targets = [square("T1", 0, 0, 0.8), square("T2", 0.8, 0, 0.2)];
	const blocks = [square("B1", 0, 0, 0.8), square("B2", 0.8, 0, 0.2)];
	const people: Record<string, number> = { B1: 10, B2: 90 };

	it("weights by block area unless told otherwise", () => {
		const { crosswalk } = buildCrosswalk(
			blocks,
			sources,
			["CODE"],
			targets,
			["CODE"],
		);
		expect(crosswalk.S?.[0]).toMatchObject({ code: "T1" });
		expect(crosswalk.S?.[0]?.weight).toBeGreaterThan(0.9);
	});

	it("weights by the measure given, such as residents", () => {
		const { crosswalk } = buildCrosswalk(
			blocks,
			sources,
			["CODE"],
			targets,
			["CODE"],
			{ measure: (block) => people[String(block.properties.CODE)] ?? 0 },
		);
		expect(crosswalk.S).toEqual([
			{ code: "T2", weight: 0.9 },
			{ code: "T1", weight: 0.1 },
		]);
	});

	it("gives a block in a hole to the area filling it, not the one around it", () => {
		// OUTER is a ring round INNER, as Kenilworth and Southam is round
		// Warwick and Leamington. OUTER is listed first.
		const outer = {
			type: "Feature" as const,
			properties: { CODE: "OUTER" },
			geometry: {
				type: "Polygon" as const,
				coordinates: [
					square("", 0, 0, 3).geometry.coordinates[0],
					square("", 1, 1, 1).geometry.coordinates[0],
				],
			},
		};
		const inner = square("INNER", 1, 1, 1);
		const { crosswalk } = buildCrosswalk(
			[square("B", 1.25, 1.25, 0.5)],
			[outer, inner],
			["CODE"],
			[square("T", 0, 0, 3)],
			["CODE"],
		);
		expect(Object.keys(crosswalk)).toEqual(["INNER"]);
	});
});
