import { describe, expect, it, vi } from "vitest";
import { resolvePopulationDensity } from "@/lib/helpers/populationDensity";
import type {
	BoundaryData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";

const dataset = (data: PopulationDataset["data"]): PopulationDataset => ({
	id: "population2023",
	type: "population",
	year: 2023,
	boundaryYear: 2022,
	boundaryType: "ward",
	data,
});

const ward = (total: number) => ({
	wardName: "Ward",
	ladCode: "LAD",
	ladName: "Example authority",
	total: { "30": total },
	males: {},
	females: {},
});

const boundaryData = (areas: Record<string, number>): BoundaryData =>
	({
		ward: {
			2022: {
				type: "FeatureCollection",
				crs: { type: "name", properties: { name: "CRS84" } },
				features: Object.entries(areas).map(([code, areaSqKm]) => ({
					type: "Feature",
					properties: { WD22CD: code, areaSqKm },
					geometry: null,
				})),
			},
		},
	}) as unknown as BoundaryData;

const area = (type: SelectedArea["type"], code: string): SelectedArea =>
	({ type, code, name: code, data: null }) as SelectedArea;

describe("resolvePopulationDensity", () => {
	it("uses the aggregate population result when no area is selected", () => {
		const result = resolvePopulationDensity({
			dataset: dataset({}),
			aggregatedData: {
				2023: {
					density: 125,
					totalArea: 8,
					populationStats: { total: 1000 },
				},
			} as any,
			boundaryData: boundaryData({}),
			selectedArea: null,
		});

		expect(result).toEqual({ density: 125, areaSqKm: 8, total: 1000 });
	});

	it("resolves a selected ward against its boundary geometry", () => {
		const result = resolvePopulationDensity({
			dataset: dataset({ W1: ward(300) }),
			aggregatedData: null,
			boundaryData: boundaryData({ W1: 2 }),
			selectedArea: area("ward", "W1"),
		});

		expect(result).toEqual({ density: 150, areaSqKm: 2, total: 300 });
	});

	it("aggregates ward population and area for a local authority", () => {
		const result = resolvePopulationDensity({
			dataset: dataset({ W1: ward(100), W2: ward(300) }),
			aggregatedData: null,
			boundaryData: boundaryData({ W1: 2, W2: 3 }),
			selectedArea: area("localAuthority", "LAD"),
			codeMapper: {
				getCodeForYear: () => undefined,
				getWardsForLad: () => ["W1", "W2"],
				getWardsForConstituency: () => [],
				getMappingGeneration: () => 0,
			},
		});

		expect(result).toEqual({ density: 80, areaSqKm: 5, total: 400 });
	});

	it("uses constituency ward membership and refreshes when mappings change", () => {
		let mappingGeneration = 0;
		const getWardsForConstituency = vi.fn(() => ["W1", "W2"]);
		const input = {
			dataset: dataset({ W1: ward(100), W2: ward(300) }),
			aggregatedData: null,
			boundaryData: boundaryData({ W1: 2, W2: 3 }),
			selectedArea: area("constituency", "C1"),
			codeMapper: {
				getCodeForYear: () => undefined,
				getWardsForLad: () => [],
				getWardsForConstituency,
				getMappingGeneration: () => mappingGeneration,
			},
		};

		expect(resolvePopulationDensity(input)).toEqual({
			density: 80,
			areaSqKm: 5,
			total: 400,
		});
		resolvePopulationDensity(input);
		mappingGeneration = 1;
		resolvePopulationDensity(input);

		expect(getWardsForConstituency).toHaveBeenCalledTimes(2);
	});
});
