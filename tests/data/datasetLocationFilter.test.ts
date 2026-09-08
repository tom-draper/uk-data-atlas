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

	it("falls through to bbox filtering for a country whose codes don't carry its GSS prefix", async () => {
		// Northern Ireland's super output area codes (e.g. "95AA01S1") don't
		// start with "N", so selecting the country must not use the
		// letter-prefix fast path that every other country geography does.
		const northernIreland = gazetteer.namedLocation("Northern Ireland")!;
		const includedCode = "95AA01S1";
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							features: [
								{
									SOA_CODE: includedCode,
									bbox: northernIreland.bbox,
								},
								{ SOA_CODE: "95AA01S2", bbox: [0, 0, 1, 1] },
							],
						}),
						{ status: 200 },
					),
			),
		);
		const payload = {
			2017: {
				boundaryYear: 2011,
				data: {
					[includedCode]: { nimdmRank: 10 },
					"95AA01S2": { nimdmRank: 20 },
				},
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Northern Ireland",
			boundaryType: "superOutputArea",
		})) as typeof payload;

		expect(filtered[2017]!.data).toEqual({
			[includedCode]: { nimdmRank: 10 },
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

	// `results` is what the choropleth paints from and is keyed exactly like
	// `data`, so leaving it whole shipped every area in the country.
	it("scopes the per-area results map alongside the records", async () => {
		const includedCode = greaterManchester.memberCodes[0]!;
		const payload = {
			2016: {
				boundaryYear: 2024,
				data: {
					[includedCode]: { leave: 10 },
					E06000001: { leave: 20 },
				},
				results: { [includedCode]: "remain", E06000001: "leave" },
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "localAuthority",
		})) as typeof payload;

		expect(filtered[2016].results).toEqual({ [includedCode]: "remain" });
		expect(Object.keys(filtered[2016].data)).toEqual([includedCode]);
	});

	// Only fields keyed by the dataset's own boundary codes may be scoped by its
	// matcher. IMD's `ladStats` is keyed by local authority while its records are
	// keyed by LSOA, so scoping it with the LSOA matcher would empty it.
	it("leaves sibling records keyed by another geography untouched", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							features: [
								{
									LSOA11CD: "E01000001",
									bbox: greaterManchester.bbox,
								},
							],
						}),
						{ status: 200 },
					),
			),
		);
		const ladStats = { E08000001: { averageRank: 5 } };
		const payload = {
			2019: {
				boundaryYear: 2011,
				data: {
					E01000001: { imdScore: 1 },
					E01000002: { imdScore: 2 },
				},
				ladStats,
			},
		};

		const filtered = (await filterDatasetPayloadForLocation(payload, {
			location: "Greater Manchester",
			boundaryType: "lsoa",
		})) as typeof payload;

		expect(filtered[2019].ladStats).toEqual(ladStats);
		expect(Object.keys(filtered[2019].data)).toEqual(["E01000001"]);
	});
});
