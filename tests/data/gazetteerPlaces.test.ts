import { describe, expect, it } from "vitest";
import { resolvePlaces } from "@/lib/data/gazetteer/places";

describe("resolvePlaces", () => {
	const locations = {
		England: {
			lad_codes: [],
			bounds: [-6, 49, 2, 56] as [number, number, number, number],
		},
		"South East": {
			// OLD1 is a superseded district kept for older ward releases;
			// CUR1 is current; CUR3 is current but belongs to another region.
			lad_codes: ["OLD1", "CUR1", "CUR3"],
			bounds: [0, 0, 1, 1] as [number, number, number, number],
		},
		"Central Belt": {
			lad_codes: ["S1"],
			bounds: [0, 0, 1, 1] as [number, number, number, number],
		},
	};
	const official = {
		England: { kind: "country" as const },
		"South East": {
			kind: "region" as const,
			code: "E12000008",
			lookup: "local-authority-to-region/2025-04-en",
		},
	};
	const lookupMembers = { E12000008: ["CUR1", "CUR2"] };
	const current = new Set(["CUR1", "CUR2", "CUR3", "S1"]);
	const places = resolvePlaces(locations, official, lookupMembers, current);

	it("takes an official place's current members from the ONS lookup", () => {
		expect(places["South East"]).toMatchObject({
			kind: "region",
			source: {
				lookup: "local-authority-to-region/2025-04-en",
				code: "E12000008",
			},
		});
		expect(places["South East"]!.lad_codes).toEqual([
			"CUR1",
			"CUR2",
			"OLD1",
		]);
	});

	it("keeps an editorial place exactly as curated, and says so", () => {
		expect(places["Central Belt"]).toEqual({
			...locations["Central Belt"],
			kind: "editorial",
		});
	});

	it("labels a country without changing how it is filtered", () => {
		expect(places.England).toEqual({
			...locations.England,
			kind: "country",
		});
	});

	it("keeps a superseded code even where another boundary file still has it", () => {
		// Barnsley's old code is in the 2023 boundaries but not the ONS lookups.
		const yorkshire = resolvePlaces(
			{ Yorkshire: { lad_codes: ["E08000016"], bounds: [0, 0, 1, 1] } },
			{
				Yorkshire: {
					kind: "region",
					code: "E12000003",
					lookup: "local-authority-to-region/2025-04-en",
				},
			},
			{ E12000003: ["E08000038"] },
			new Set(["E08000038"]),
		).Yorkshire!;
		expect(yorkshire.lad_codes).toEqual(["E08000038", "E08000016"]);
	});

	it("fails the build when a lookup lacks an official place", () => {
		expect(() => resolvePlaces(locations, official, {}, current)).toThrow(
			/E12000008/,
		);
	});
});
