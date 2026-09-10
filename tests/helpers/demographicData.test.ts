import { describe, expect, it, vi } from "vitest";
import {
	getAreaCachedValue,
	resolvePopulationAreaWards,
} from "@/lib/helpers/demographicData";

describe("getAreaCachedValue", () => {
	it("invalidates entries when the dataset slice or mappings change", () => {
		const cache = new Map<string, Map<number, number>>();
		const dataset = {};
		const compute = vi.fn(() => 10);

		expect(
			getAreaCachedValue(
				cache,
				"constituency-C1",
				2021,
				dataset,
				0,
				compute,
			),
		).toBe(10);
		expect(
			getAreaCachedValue(
				cache,
				"constituency-C1",
				2021,
				dataset,
				0,
				compute,
			),
		).toBe(10);
		expect(compute).toHaveBeenCalledTimes(1);

		getAreaCachedValue(cache, "constituency-C1", 2021, dataset, 1, compute);
		getAreaCachedValue(cache, "constituency-C1", 2021, {}, 1, compute);
		expect(compute).toHaveBeenCalledTimes(3);
	});
});

describe("resolvePopulationAreaWards", () => {
	const dataset = {
		boundaryYear: 2024,
		data: {
			W1: {
				wardName: "One",
				ladCode: "L1",
				ladName: "LAD",
				total: {},
				males: {},
				females: {},
			},
			W2: {
				wardName: "Two",
				ladCode: "L1",
				ladName: "LAD",
				total: {},
				males: {},
				females: {},
			},
		},
	} as any;
	const codeMapper = {
		getCodeForYear: vi.fn(),
		getWardsForLad: vi.fn(() => ["W1", "W2"]),
		getWardsForConstituency: vi.fn(() => ["W2"]),
		getMappingGeneration: vi.fn(() => 0),
	};

	it("resolves direct wards and mapped larger areas into code/data pairs", () => {
		expect(
			resolvePopulationAreaWards(
				dataset,
				{
					type: "ward",
					code: "W1",
					name: "One",
					data: null,
				},
				codeMapper,
			),
		).toMatchObject([{ code: "W1" }]);
		expect(
			resolvePopulationAreaWards(
				dataset,
				{
					type: "localAuthority",
					code: "L1",
					name: "LAD",
					data: null,
				},
				codeMapper,
			),
		).toMatchObject([{ code: "W1" }, { code: "W2" }]);
		expect(
			resolvePopulationAreaWards(
				dataset,
				{
					type: "constituency",
					code: "C1",
					name: "Constituency",
					data: null,
				},
				codeMapper,
			),
		).toMatchObject([{ code: "W2" }]);
	});

	it("distinguishes an unavailable mapping from an empty supported area", () => {
		const area = {
			type: "localAuthority",
			code: "L1",
			name: "LAD",
			data: null,
		} as const;

		expect(resolvePopulationAreaWards(dataset, area, undefined)).toBeNull();
	});

	it("keeps the geometry code when it maps to a dataset-vintage code", () => {
		const mapped = resolvePopulationAreaWards(
			dataset,
			{ type: "ward", code: "W-legacy", name: "Old ward", data: null },
			{ ...codeMapper, getCodeForYear: vi.fn(() => "W2") },
		);

		expect(mapped).toMatchObject([
			{ code: "W-legacy", data: { wardName: "Two" } },
		]);
	});
});
