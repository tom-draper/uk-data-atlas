import { createCustomDataset } from "@/lib/data/custom/dataset";

describe("createCustomDataset", () => {
	it("creates a choropleth dataset and ignores invalid rows", () => {
		const dataset = createCustomDataset("dataset-1", {
			file: "rates.csv",
			headerRow: 0,
			data: [
				["Code", "Rate"],
				["E06000001", "12.5"],
				["E06000002", "not a number"],
			],
			mode: "choropleth",
			selectedColumn: "Code",
			dataColumn: "Rate",
			boundaryType: "localAuthority",
			boundaryYear: 2024,
		});

		expect(dataset).toMatchObject({
			id: "dataset-1",
			kind: "choropleth",
			boundaryYear: 2024,
			data: { E06000001: 12.5 },
		});
	});

	it("creates a point dataset with its value range", () => {
		const dataset = createCustomDataset("dataset-2", {
			file: "points.csv",
			headerRow: 0,
			data: [
				["Latitude", "Longitude", "Value"],
				["51.5", "-0.1", "10"],
				["invalid", "-0.2", "20"],
				["52", "-0.3", "30"],
			],
			mode: "points",
			latColumn: "Latitude",
			lngColumn: "Longitude",
			dataColumn: "Value",
		});

		expect(dataset).toMatchObject({
			id: "dataset-2",
			kind: "points",
			points: [
				{ lat: 51.5, lng: -0.1, value: 10 },
				{ lat: 52, lng: -0.3, value: 30 },
			],
			valueMin: 10,
			valueMax: 30,
		});
	});
});
