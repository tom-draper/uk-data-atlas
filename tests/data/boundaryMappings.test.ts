import { describe, expect, it } from "vitest";
import {
	buildCrossYearMappings,
	encodeBoundaryMappings,
	extractWardLadMappings,
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
		constituencyToWards: { 2026: { C1: ["W2"] } },
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

	it("rejects the unencoded version 1 file", () => {
		expect(() =>
			parsePrecompiledBoundaryMappings({ version: 1, ...mappings }),
		).toThrow();
	});
});
