import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { broadbandDefinition } from "@/lib/datasets/broadband";
import type { BroadbandDataset } from "@/lib/types/broadband";

const dataset: BroadbandDataset = {
	id: "broadband2025",
	type: "broadband",
	year: 2025,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			pctSuperfast: 96,
			pctUltrafast: 70,
			pctFullFibre: 61,
			pctGigabit: 73,
			premisesCount: 100,
		},
	},
};

describe("broadband map metric", () => {
	it("uses the selected coverage measure", () => {
		const valueFor = broadbandDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(61);

		for (const [measure, expected] of [
			["superfast", 96],
			["ultrafast", 70],
			["gigabit", 73],
		] as const) {
			expect(
				valueFor?.(dataset, "E1", {
					...DEFAULT_MAP_OPTIONS,
					broadband: {
						...DEFAULT_MAP_OPTIONS.broadband,
						measure,
					},
				}),
			).toBe(expected);
		}
	});
});
