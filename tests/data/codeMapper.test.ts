import { describe, expect, it } from "vitest";
import { CodeMapperStore } from "@/lib/data/boundaries/codeMapper";

describe("CodeMapperStore", () => {
	it("resolves wards through cross-year mappings and LAD fallbacks", () => {
		const mapper = new CodeMapperStore();
		mapper.addCodeMapping("ward", "W-2021", 2024, "W-2024");
		mapper.addWardLadMapping("W-2024", "L1");
		mapper.addLadWardMappings(2024, { L1: ["W-2024"] });

		expect(mapper.getLadForWard("W-2021")).toBe("L1");
		expect(mapper.getWardsForLad("L1", 2023)).toEqual(["W-2024"]);
	});

	it("maintains reverse indexes for source and highlight lookups", () => {
		const mapper = new CodeMapperStore();
		mapper.addCodeMappings("constituency", {
			"C-2019": { 2024: "C-2024" },
			"C-2017": { 2024: "C-2024", 2019: "C-2019" },
		});
		mapper.addConstituencyWardMappings(2024, { "C-2024": ["W1", "W2"] });

		expect(mapper.findSourceCodes("constituency", "C-2024", 2024)).toEqual(
			expect.arrayContaining(["C-2019", "C-2017"]),
		);
		expect(mapper.getHighlightCodes("constituency", "C-2024")).toEqual(
			new Set(["C-2024", "C-2019", "C-2017"]),
		);
		expect(mapper.getWardsForConstituency("C-2019", 2024)).toEqual([
			"W1",
			"W2",
		]);
	});
});
