import { describe, expect, it } from "vitest";
import {
	encodeBoundaryMappings,
	encodeParishLadMappings,
	parseBoundaryWardToLad,
	parseParishLadMappings,
	parsePrecompiledBoundaryMappings,
	type PrecompiledBoundaryMappings,
} from "../src";

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
});

describe("parish local authority mappings", () => {
	it("round-trips, storing a parent held in several years once", () => {
		const byYear = {
			2023: { P1: "L1", P2: "L2" },
			2024: { P1: "L1", P2: "L3" },
		};
		const encoded = encodeParishLadMappings(byYear);
		expect(encoded.parishToLad.parents.P1).toEqual({ L1: 0b11 });
		expect(
			parseParishLadMappings(JSON.parse(JSON.stringify(encoded))),
		).toEqual(byYear);
	});

	it("rejects another version", () => {
		expect(() =>
			parseParishLadMappings({
				...encodeParishLadMappings({}),
				version: 2,
			}),
		).toThrow();
	});
});
