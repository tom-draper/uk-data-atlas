import { describe, expect, it } from "vitest";
import { filterGeometryToDatasetCoverage } from "@/lib/helpers/datasetCoverage";

const geometry = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { WD24CD: "E05000001" },
			geometry: null,
		},
		{
			type: "Feature",
			properties: { WD24CD: "W05000001" },
			geometry: null,
		},
		{
			type: "Feature",
			properties: { WD24CD: "S13000001" },
			geometry: null,
		},
		{
			type: "Feature",
			properties: { WD24CD: "N05000001" },
			geometry: null,
		},
	],
} as any;

const localElection = {
	id: "localElection2024",
	type: "localElection",
	year: 2024,
	boundaryType: "ward",
	boundaryYear: 2024,
	partyInfo: [],
	data: {},
	results: {},
	coverageCountries: ["GB-ENG", "GB-WLS"],
} as any;

describe("filterGeometryToDatasetCoverage", () => {
	it("keeps all in-scope countries even when they have no result", () => {
		const filtered = filterGeometryToDatasetCoverage(
			geometry,
			localElection,
		);

		expect(
			filtered.features.map(
				(feature) =>
					(feature.properties as unknown as Record<string, string>)
						.WD24CD,
			),
		).toEqual(["E05000001", "W05000001"]);
	});

	it("leaves datasets without declared coverage unchanged", () => {
		expect(
			filterGeometryToDatasetCoverage(geometry, {
				...localElection,
				coverageCountries: undefined,
			}),
		).toBe(geometry);
	});

	it("filters local-authority geometry by the current LAD code property", () => {
		const localAuthorityGeometry = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { LAD24CD: "E06000001" },
					geometry: null,
				},
				{
					type: "Feature",
					properties: { LAD24CD: "W06000001" },
					geometry: null,
				},
				{
					type: "Feature",
					properties: { LAD24CD: "S12000033" },
					geometry: null,
				},
				{
					type: "Feature",
					properties: { LAD24CD: "N09000001" },
					geometry: null,
				},
			],
		} as any;

		const filtered = filterGeometryToDatasetCoverage(
			localAuthorityGeometry,
			{
				id: "ethnicity2021",
				type: "ethnicity",
				year: 2021,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data: {},
				results: {},
				coverageCountries: ["GB-ENG", "GB-WLS"],
			} as any,
		);

		expect(
			filtered.features.map(
				(feature) =>
					(feature.properties as unknown as Record<string, string>)
						.LAD24CD,
			),
		).toEqual(["E06000001", "W06000001"]);
	});
});
