import { afterEach, describe, expect, it, vi } from "vitest";
import { gazetteer } from "@/lib/data/gazetteer/static";
import { filterDatasetPayloadForLocation } from "@/lib/data/datasetLocationFilter";

const greaterManchester = gazetteer.namedLocation("Greater Manchester")!;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("location-scoped chart datasets", () => {
	it("keeps only local-authority records which cards can hover in the location", async () => {
		const includedCode = greaterManchester.memberCodes[0]!;
		const payload = {
			2024: {
				boundaryYear: 2024,
				data: {
					[includedCode]: { value: 10 },
					E06000001: { value: 20 },
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "localAuthority",
		})) as typeof payload;

		expect(filtered[2024]!.data).toEqual({
			[includedCode]: { value: 10 },
		});
	});

	it("keeps ward records by their local-authority membership", async () => {
		const includedCode = "E05000001";
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							wardToLad: {
								[includedCode]:
									greaterManchester.memberCodes[0],
								E05000002: "E06000001",
							},
						}),
						{ status: 200 },
					),
			),
		);
		const payload = {
			2024: {
				boundaryYear: 2024,
				data: {
					[includedCode]: { votes: 10 },
					E05000002: { votes: 20 },
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "ward",
		})) as typeof payload;

		expect(filtered[2024]!.data).toEqual({
			[includedCode]: { votes: 10 },
		});
	});

	it("keeps constituencies which overlap a member local authority", async () => {
		const includedCode = "E14000001";
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							releases: {
								"2024-07-uk-bgc": {
									[includedCode]: [
										{
											code: greaterManchester
												.memberCodes[0],
											weight: 1,
										},
									],
									E14000002: [
										{ code: "E06000001", weight: 1 },
									],
								},
							},
						}),
						{ status: 200 },
					),
			),
		);
		const payload = {
			2024: {
				boundaryYear: 2024,
				data: {
					[includedCode]: { votes: 10 },
					E14000002: { votes: 20 },
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "constituency",
		})) as typeof payload;

		expect(filtered[2024]!.data).toEqual({
			[includedCode]: { votes: 10 },
		});
	});

	it("returns compact all-location population totals before slicing wards", async () => {
		const includedLad = greaterManchester.memberCodes[0]!;
		const payload = {
			2022: {
				boundaryYear: 2023,
				data: {
					E05000001: {
						ladCode: includedLad,
						total: { 0: 100, 1: 200 },
					},
					E05000002: {
						ladCode: "E06000001",
						total: { 0: 300 },
					},
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "ward",
			includeLocationPopulationSummary: true,
		})) as typeof payload & {
			2022: { locationPopulations: Record<string, number> };
		};

		expect(filtered[2022].locationPopulations["Greater Manchester"]).toBe(
			300,
		);
		expect(filtered[2022].locationPopulations.England).toBe(600);
	});

	it("keeps only the selected precomputed card aggregate", async () => {
		const includedCode = greaterManchester.memberCodes[0]!;
		const greaterManchesterAggregate = {
			partyVotes: { LAB: 10 },
			electorate: 20,
			totalVotes: 10,
		};
		const payload = {
			2024: {
				boundaryYear: 2024,
				data: {
					[includedCode]: { value: 10 },
					E06000001: { value: 20 },
				},
				locationAggregates: {
					"Greater Manchester": greaterManchesterAggregate,
					Lancashire: {
						partyVotes: { CON: 12 },
						electorate: 24,
						totalVotes: 12,
					},
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "localAuthority",
		})) as {
			2024: {
				data: Record<string, { value: number }>;
				locationAggregate: typeof greaterManchesterAggregate;
				locationAggregates?: undefined;
			};
		};

		expect(filtered[2024].locationAggregate).toEqual(
			greaterManchesterAggregate,
		);
		expect(filtered[2024].locationAggregates).toBeUndefined();
		expect(filtered[2024].data).toEqual({
			[includedCode]: { value: 10 },
		});
	});
});
