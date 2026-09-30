import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	bestFitContainer,
	encodeBoundaryMappings,
	parseBoundaryWardToLad,
	parsePrecompiledBoundaryMappings,
	type PrecompiledBoundaryMappings,
} from "@/lib/data/boundaries/mappings";

describe("shipped boundary mappings", () => {
	const mappings: PrecompiledBoundaryMappings = {
		wardToLad: { W1: "L1", W2: "L1" },
		ladToWards: {
			2024: { L1: ["W1", "W2"] },
			2025: { L1: ["W1", "W2"] },
			2026: { L1: ["W2"] },
		},
		constituencyToWards: {
			2024: { C1: ["W1", "W2"] },
			2026: { C1: ["W2"], C2: ["W1"] },
		},
	};

	it("round-trips through the shipped encoding", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		expect(parsePrecompiledBoundaryMappings(shipped)).toEqual(mappings);
	});

	it("stores a target shared by several years once", () => {
		const shipped = encodeBoundaryMappings(mappings);
		expect(shipped.ladToWards.members.L1).toEqual({
			W1: 0b011,
			W2: 0b111,
		});
	});

	it("rejects a mask that names a year the file does not list", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		shipped.constituencyToWards.members.C1 = { W1: 0b100 };
		expect(() => parsePrecompiledBoundaryMappings(shipped)).toThrow();
	});

	it("reads the ward to local authority map alone", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		expect(parseBoundaryWardToLad(shipped)).toEqual(mappings.wardToLad);
		expect(() =>
			parseBoundaryWardToLad({ ...shipped, version: 1 }),
		).toThrow();
	});

	it("rejects earlier versions, such as the one holding name-matched code mappings", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		for (const version of [2, 3])
			expect(() =>
				parsePrecompiledBoundaryMappings({ ...shipped, version }),
			).toThrow();
	});

	it("rejects the unencoded version 1 file", () => {
		expect(() =>
			parsePrecompiledBoundaryMappings({ version: 1, ...mappings }),
		).toThrow();
	});

	it("uses the ONS 2025 ward-to-2024 constituency lookup where a ward is not split", () => {
		const shipped = JSON.parse(
			readFileSync(
				join(
					process.cwd(),
					"public/data/datasets/boundary-mappings.json",
				),
				"utf8",
			),
		);
		const actual = parsePrecompiledBoundaryMappings(shipped);
		// Ainsdale is an unsplit 2025 ward in the ONS lookup.
		expect(actual.constituencyToWards[2025]?.E14001463).toContain(
			"E05000932",
		);
	});
});

describe("best-fit container", () => {
	const square = (x0: number, x1: number) => [
		[x0, 0],
		[x1, 0],
		[x1, 10],
		[x0, 10],
		[x0, 0],
	];
	const collection = (
		key: string,
		areas: Array<[code: string, ring: number[][]]>,
	) =>
		({
			type: "FeatureCollection",
			features: areas.map(([code, ring]) => ({
				type: "Feature",
				properties: { [key]: code },
				geometry: { type: "Polygon", coordinates: [ring] },
			})),
		}) as any;
	const constituencies = collection("PCON24CD", [
		["A", square(0, 10)],
		["B", square(10, 20)],
	]);
	const membership = (wards: Array<[string, number[][]]>) =>
		bestFitContainer(
			collection("WD24CD", wards),
			["WD24CD"],
			constituencies,
			["PCON24CD"],
		);

	it("places a ward in the constituency holding most of its area", () => {
		// Five of six units lie in B, but most vertices sit on the left
		// edge, where an average of the vertices would fall in A.
		const leftEdge = Array.from({ length: 19 }, (_, i) => [8, 9.5 - i / 2]);
		const leaning = [
			[8, 0],
			[20, 0],
			[20, 10],
			[8, 10],
			...leftEdge,
			[8, 0],
		];
		expect(membership([["W1", leaning]])).toEqual({ W1: "B" });
	});

	it("places a straddling ward once, where most of it is", () => {
		expect(membership([["W1", square(6, 12)]])).toEqual({ W1: "A" });
	});

	it("still places a ward too thin for any sample to land inside", () => {
		const sliver = [
			[2, 2],
			[4, 4],
			[6, 6],
			[2, 2],
		];
		expect(membership([["W1", sliver]])).toEqual({ W1: "A" });
	});
});
