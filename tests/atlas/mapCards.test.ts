import { describe, expect, it } from "vitest";
import { firstSentence, mapCardSentence } from "@/lib/atlas/mapCards";
import { ATLAS_MAPS, findAtlasLocation } from "@/lib/atlas/pages";

describe("firstSentence", () => {
	it("keeps a description's first sentence", () => {
		expect(
			firstSentence(
				"Ward population estimates for mid-2022. Newer ONS ward estimates use May 2025 boundaries.",
			),
		).toBe("Ward population estimates for mid-2022.");
	});

	it("keeps a single sentence whole", () => {
		expect(firstSentence(" Census ethnicity estimates. ")).toBe(
			"Census ethnicity estimates.",
		);
	});

	it("ends a long first sentence at its first clause", () => {
		expect(
			firstSentence(
				"Total jobs by local authority district, 2011 to 2024, on April 2023 codes: employee jobs, self-employment jobs and HM Forces. More.",
			),
		).toBe("Total jobs by local authority district.");
	});
});

describe("mapCardSentence", () => {
	it("is one short sentence for every map of a place", () => {
		const england = findAtlasLocation("england")!;
		for (const map of ATLAS_MAPS) {
			const sentence = mapCardSentence(england, map, true);
			expect(sentence.length).toBeGreaterThan(0);
			expect(sentence).not.toMatch(/\.\s+[A-Z]/);
		}
	});
});
