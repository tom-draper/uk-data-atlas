import { describe, expect, it } from "vitest";
import type { AreaLineage } from "@/lib/data/boundaries/areaLineage";
import { CodeMapperStore } from "@/lib/data/boundaries/codeMapper";

// Releases named by their year. W-2021 is renumbered W-2024 with its extent
// unchanged; S keeps its code into 2024 but its boundary moves, so the S of
// 2024 is not the S of 2021.
const wards: AreaLineage = {
	schemaVersion: 1,
	geography: "ward",
	releases: ["2021", "2024", "2025"],
	steps: [
		{
			forward: { "W-2021": "W-2024", S: null },
			backward: { "W-2024": "W-2021", S: null },
		},
		{ forward: {}, backward: {} },
	],
	overrides: {},
};

const constituencies: AreaLineage = {
	schemaVersion: 1,
	geography: "constituency",
	releases: ["2019", "2024"],
	steps: [
		{ forward: { "C-2019": "C-2024" }, backward: { "C-2024": "C-2019" } },
	],
	overrides: {},
};

const mapperWith = (...lineages: AreaLineage[]) => {
	const mapper = new CodeMapperStore((_, year) => String(year));
	for (const lineage of lineages)
		mapper.setAreaLineage(
			lineage.geography as "ward" | "constituency",
			lineage,
		);
	return mapper;
};

describe("CodeMapperStore", () => {
	it("says when another year's area is a realigned successor", () => {
		// R is redrawn by a street as R2 in 2024, then keeps its code.
		const mapper = mapperWith({
			...wards,
			steps: [
				{
					forward: { ...wards.steps[0]!.forward, R: "R2" },
					backward: { ...wards.steps[0]!.backward, R2: "R" },
				},
				wards.steps[1]!,
			],
			realigned: {
				steps: [
					{ forward: ["R"], backward: ["R2"] },
					{ forward: [], backward: [] },
				],
				overrides: {},
			},
		});
		expect(mapper.getCodeForYear("ward", "R", 2025, 2021)).toBe("R2");
		expect(mapper.isRealigned("ward", "R", 2025, 2021)).toBe(true);
		expect(mapper.isRealigned("ward", "R2", 2021, 2025)).toBe(true);
		expect(mapper.isRealigned("ward", "R2", 2025, 2024)).toBe(false);
		expect(mapper.isRealigned("ward", "W-2021", 2025, 2021)).toBe(false);
	});

	it("finds the same area in another year from the year it is from", () => {
		const mapper = mapperWith(wards);
		expect(mapper.getCodeForYear("ward", "W-2021", 2025, 2021)).toBe(
			"W-2024",
		);
		expect(mapper.getCodeForYear("ward", "W-2024", 2021, 2024)).toBe(
			"W-2021",
		);
		// The code carries on, but not its area.
		expect(mapper.getCodeForYear("ward", "S", 2024, 2021)).toBeUndefined();
		expect(mapper.getCodeForYear("ward", "S", 2025, 2024)).toBe("S");
		expect(mapper.getCodeForYear("ward", "K", 2025, 2021)).toBe("K");
	});

	it("infers the year a code is from where it is not given", () => {
		const mapper = mapperWith(wards);
		expect(mapper.getCodeForYear("ward", "W-2021", 2025)).toBe("W-2024");
		expect(mapper.getCodeForYear("ward", "W-2024", 2021)).toBe("W-2021");
		expect(mapper.getCodeForYear("ward", "K", 2021)).toBe("K");
		// No lineage for the geography, or no release for the year.
		expect(mapper.getCodeForYear("lsoa", "E01", 2021)).toBeUndefined();
		expect(mapper.getCodeForYear("ward", "K", 2030)).toBeUndefined();
	});

	it("resolves a ward's local authority through the same area in other years", () => {
		const mapper = mapperWith(wards);
		mapper.addWardLadMapping("W-2024", "L1");
		mapper.addLadWardMappings(2024, { L1: ["W-2024"] });

		expect(mapper.getLadForWard("W-2021")).toBe("L1");
		expect(mapper.getWardsForLad("L1", 2023)).toEqual(["W-2024"]);
	});

	it("resolves constituency wards and a ward's constituency across years", () => {
		const mapper = mapperWith(wards, constituencies);
		mapper.addConstituencyWardMappings(2024, { "C-2024": ["W1", "W2"] });
		mapper.addConstituencyWardMappings(2025, { "C-2019": ["W-2024"] });

		expect(mapper.getWardsForConstituency("C-2019", 2024)).toEqual([
			"W1",
			"W2",
		]);
		expect(mapper.getConstituencyForWard("W-2021", 2024)).toBe("C-2024");
	});

	it("advances the mapping generation as mappings and lineages load", () => {
		const mapper = new CodeMapperStore();
		expect(mapper.getMappingGeneration()).toBe(0);

		mapper.addConstituencyWardMappings(2024, { C1: ["W1"] });
		expect(mapper.getMappingGeneration()).toBe(1);

		mapper.setAreaLineage("ward", wards);
		expect(mapper.getMappingGeneration()).toBe(2);

		mapper.clearAllMappings();
		expect(mapper.getMappingGeneration()).toBe(3);
		expect(mapper.getCodeForYear("ward", "W-2021", 2024)).toBeUndefined();
	});
});
