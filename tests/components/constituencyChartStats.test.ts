import { describe, expect, it } from "vitest";
import { resolveBrexitHanrettyStats } from "@/components/elections/referendum/BrexitHanrettyEstimatesChart";
import type { BrexitConstituencyDataset, SelectedArea } from "@/lib/types";

const ward: SelectedArea = {
	type: "ward",
	code: "W1",
	name: "Example ward",
	data: null,
};

const codeMapper = { getConstituencyForWard: () => "C1" };

describe("constituency chart stats", () => {
	it("shows Hanretty estimates for a ward's best-fit constituency", () => {
		const dataset: BrexitConstituencyDataset = {
			id: "brexit-constituency-2016",
			type: "brexitConstituency",
			year: 2016,
			boundaryType: "constituency",
			boundaryYear: 2024,
			data: {
				C1: {
					constituencyCode: "C1",
					constituencyName: "Example constituency",
					pctLeave: 55,
					isKnownResult: true,
				},
			},
			results: { C1: "leave" },
		};

		expect(
			resolveBrexitHanrettyStats(dataset, null, ward, codeMapper),
		).toEqual({ pctLeave: 55, pctRemain: 45 });
	});
});
