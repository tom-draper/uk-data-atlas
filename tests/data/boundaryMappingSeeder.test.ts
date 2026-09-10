import { describe, expect, it, vi } from "vitest";
import {
	applyBoundaryMappings,
	type BoundaryMappingTarget,
} from "@/lib/data/boundaries/mappingSeeder";
import type { PrecompiledBoundaryMappings } from "@/lib/data/boundaries/mappings";

describe("precompiled boundary mapping seeding", () => {
	it("applies every mapping family to its destination", () => {
		const mappings: PrecompiledBoundaryMappings = {
			version: 1,
			wardToLad: { W1: "L1" },
			ladToWards: { 2024: { L1: ["W1"] } },
			codeMappings: {
				ward: { W1: { 2025: "W2" } },
				constituency: { C1: { 2024: "C2" } },
				localAuthority: { L1: { 2025: "L2" } },
			},
			constituencyToWards: { 2024: { C2: ["W1"] } },
		};
		const target: BoundaryMappingTarget = {
			addWardLadMappings: vi.fn(),
			addLadWardMappings: vi.fn(),
			addCodeMappings: vi.fn(),
			addConstituencyWardMappings: vi.fn(),
		};

		applyBoundaryMappings(mappings, target);

		expect(target.addWardLadMappings).toHaveBeenCalledWith({ W1: "L1" });
		expect(target.addLadWardMappings).toHaveBeenCalledWith(2024, {
			L1: ["W1"],
		});
		expect(target.addCodeMappings).toHaveBeenCalledWith(
			"ward",
			mappings.codeMappings.ward,
		);
		expect(target.addCodeMappings).toHaveBeenCalledWith(
			"constituency",
			mappings.codeMappings.constituency,
		);
		expect(target.addCodeMappings).toHaveBeenCalledWith(
			"localAuthority",
			mappings.codeMappings.localAuthority,
		);
		expect(target.addConstituencyWardMappings).toHaveBeenCalledWith(2024, {
			C2: ["W1"],
		});
	});
});
