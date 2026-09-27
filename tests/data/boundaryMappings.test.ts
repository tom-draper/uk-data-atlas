import { describe, expect, it } from "vitest";
import {
	buildConstituencyWardMappings,
	buildCrossYearMappings,
	encodeBoundaryMappings,
	extractWardLadMappings,
	parseBoundaryWardToLad,
	parsePrecompiledBoundaryMappings,
	type PrecompiledBoundaryMappings,
} from "@/lib/data/boundaries/mappings";

const geojson = (properties: Record<string, string>) =>
	({
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "CRS84" } },
		features: [
			{
				type: "Feature",
				properties,
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[0, 0],
							[1, 0],
							[0, 1],
							[0, 0],
						],
					],
				},
			},
		],
	}) as any;

describe("boundary mappings", () => {
	it("extracts ward and local-authority indexes in one pass", () => {
		const mappings = extractWardLadMappings(
			geojson({ WD24CD: "W1", LAD24CD: "L1" }).features,
			["WD24CD"],
			["LAD24CD"],
		);

		expect(mappings).toEqual({
			wardToLad: { W1: "L1" },
			ladToWards: { L1: ["W1"] },
		});
	});

	it("maps same-named wards only within the same local authority", () => {
		const mappings = buildCrossYearMappings(
			{
				2023: geojson({
					WD23CD: "W-old",
					WD23NM: "Central",
					LAD23CD: "L1",
				}),
				2024: geojson({
					WD24CD: "W-new",
					WD24NM: " central ",
					LAD24CD: "L1",
				}),
				2025: geojson({
					WD25CD: "W-other",
					WD25NM: "Central",
					LAD25CD: "L2",
				}),
			},
			"ward",
			[2023, 2024, 2025],
		);

		expect(mappings["W-old"]).toEqual({ 2024: "W-new" });
		expect(mappings["W-new"]).toEqual({ 2023: "W-old" });
		expect(mappings["W-other"]).toEqual({});
	});
});

describe("shipped boundary mappings", () => {
	const mappings: PrecompiledBoundaryMappings = {
		wardToLad: { W1: "L1", W2: "L1" },
		ladToWards: {
			2024: { L1: ["W1", "W2"] },
			2025: { L1: ["W1", "W2"] },
			2026: { L1: ["W2"] },
		},
		codeMappings: {
			ward: {
				W1: { 2024: "W1", 2025: "W1", 2026: "W2" },
				W2: { 2024: "W1", 2025: "W1", 2026: "W2" },
			},
			constituency: { C1: { 2024: "C2" } },
			localAuthority: { L1: { 2025: "L1" } },
		},
		constituencyToWards: {
			2024: { C1: ["W1", "W2"] },
			2026: { C1: ["W2"], C2: ["W1"] },
		},
	};

	it("round-trips through the shipped encoding", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		expect(parsePrecompiledBoundaryMappings(shipped)).toEqual(mappings);
	});

	it("stores a target shared by several years once", () => {
		const shipped = encodeBoundaryMappings(mappings);
		expect(shipped.codeMappings.ward.targets.W1).toEqual({
			W1: 0b011,
			W2: 0b100,
		});
		expect(shipped.ladToWards.members.L1).toEqual({
			W1: 0b011,
			W2: 0b111,
		});
	});

	it("rejects a mask that names a year the file does not list", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		shipped.codeMappings.constituency.targets.C1 = { C2: 0b10 };
		expect(() => parsePrecompiledBoundaryMappings(shipped)).toThrow();
	});

	it("reads the ward to local authority map alone", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		expect(parseBoundaryWardToLad(shipped)).toEqual(mappings.wardToLad);
		expect(() =>
			parseBoundaryWardToLad({ ...shipped, version: 1 }),
		).toThrow();
	});

	it("rejects the version 2 file, whose ward membership is unmasked", () => {
		const shipped = JSON.parse(
			JSON.stringify(encodeBoundaryMappings(mappings)),
		);
		expect(() =>
			parsePrecompiledBoundaryMappings({ ...shipped, version: 2 }),
		).toThrow();
	});

	it("rejects the unencoded version 1 file", () => {
		expect(() =>
			parsePrecompiledBoundaryMappings({ version: 1, ...mappings }),
		).toThrow();
	});
});

describe("constituency to ward membership", () => {
	const square = (x0: number, x1: number) => [
		[x0, 0],
		[x1, 0],
		[x1, 10],
		[x0, 10],
		[x0, 0],
	];
	const collection = (
		key: string,
		areas: Array<[code: string, ring: number[][]]>,
	) =>
		({
			type: "FeatureCollection",
			features: areas.map(([code, ring]) => ({
				type: "Feature",
				properties: { [key]: code },
				geometry: { type: "Polygon", coordinates: [ring] },
			})),
		}) as any;
	const constituencies = collection("PCON24CD", [
		["A", square(0, 10)],
		["B", square(10, 20)],
	]);
	const membership = (wards: Array<[string, number[][]]>) =>
		buildConstituencyWardMappings(
			collection("WD24CD", wards),
			constituencies,
		);

	it("places a ward in the constituency holding most of its area", () => {
		// Five of six units lie in B, but most vertices sit on the left
		// edge, where an average of the vertices would fall in A.
		const leftEdge = Array.from({ length: 19 }, (_, i) => [8, 9.5 - i / 2]);
		const leaning = [
			[8, 0],
			[20, 0],
			[20, 10],
			[8, 10],
			...leftEdge,
			[8, 0],
		];
		expect(membership([["W1", leaning]])).toEqual({ B: ["W1"] });
	});

	it("places a straddling ward once, where most of it is", () => {
		expect(membership([["W1", square(6, 12)]])).toEqual({ A: ["W1"] });
	});

	it("still places a ward too thin for any sample to land inside", () => {
		const sliver = [
			[2, 2],
			[4, 4],
			[6, 6],
			[2, 2],
		];
		expect(membership([["W1", sliver]])).toEqual({ A: ["W1"] });
	});
});
