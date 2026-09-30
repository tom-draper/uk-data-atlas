import { describe, expect, it } from "vitest";
import { resolveBrexitHanrettyStats } from "@/components/elections/referendum/BrexitHanrettyEstimatesChart";
import { resolveSchoolPerformanceConstituencyStats } from "@/components/education/SchoolPerformanceConstituencyChart";
import type {
	BrexitConstituencyDataset,
	SchoolPerformanceConstituencyDataset,
	SelectedArea,
} from "@/lib/types";

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

	it("shows GCSE performance for a ward's best-fit constituency", () => {
		const dataset: SchoolPerformanceConstituencyDataset = {
			id: "school-performance-constituency-2025",
			type: "schoolPerformanceConstituency",
			year: 2025,
			boundaryType: "constituency",
			boundaryYear: 2024,
			data: {
				C1: {
					pconCode: "C1",
					pconName: "Example constituency",
					ptL2basics94: 68,
					ptL2basics95: 49,
					avgAtt8: 50,
					avgP8score: 0.1,
					pupils: 500,
					series: {},
				},
			},
		};

		expect(
			resolveSchoolPerformanceConstituencyStats(
				dataset,
				null,
				ward,
				codeMapper,
			),
		).toEqual({
			ptL2basics94: 68,
			ptL2basics95: 49,
			avgAtt8: 50,
			avgP8score: 0.1,
		});
	});
});
