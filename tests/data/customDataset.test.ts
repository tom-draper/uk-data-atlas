import {
	createCsvImportDocument,
	materialiseCustomImport,
	validateCustomImport,
} from "@/lib/data/custom/import";

describe("custom import materialisation", () => {
	it("creates a choropleth dataset and reports invalid rows", () => {
		const document = createCsvImportDocument(
			"rates.csv",
			[
				["Code", "Rate"],
				["E06000001", "12.5"],
				["E06000002", "not a number"],
			],
			0,
		);
		const { dataset, report } = materialiseCustomImport(
			"dataset-1",
			document,
			{
				kind: "choropleth",
				codeColumn: "Code",
				valueColumn: "Rate",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
			},
		);

		expect(dataset).toMatchObject({
			id: "dataset-1",
			kind: "choropleth",
			boundaryYear: 2024,
			data: { E06000001: 12.5 },
		});
		expect(report).toMatchObject({
			valid: true,
			acceptedRows: 1,
			rejectedRows: 1,
			issues: [
				{
					code: "invalid-row",
					rows: [3],
					count: 1,
				},
			],
		});
	});

	it("creates a point dataset with its value range", () => {
		const document = createCsvImportDocument(
			"points.csv",
			[
				["Latitude", "Longitude", "Value"],
				["51.5", "-0.1", "10"],
				["invalid", "-0.2", "20"],
				["52", "-0.3", "30"],
			],
			0,
		);
		const { dataset } = materialiseCustomImport("dataset-2", document, {
			kind: "points",
			latitudeColumn: "Latitude",
			longitudeColumn: "Longitude",
			valueColumn: "Value",
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

	it("resolves a name-matched boundary column to its code", () => {
		const { dataset } = materialiseCustomImport(
			"dataset-3",
			createCsvImportDocument(
				"named-areas.csv",
				[
					["Area", "Rate"],
					["Hartlepool", "12.5"],
				],
				0,
			),
			{
				kind: "choropleth",
				codeColumn: "Area",
				valueColumn: "Rate",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				nameToCodes: new Map([["hartlepool", ["E06000001"]]]),
			},
		);

		expect(dataset?.data).toEqual({ E06000001: 12.5 });
	});

	it("leaves off rows whose name several areas share, and says which", () => {
		const document = createCsvImportDocument(
			"wards.csv",
			[
				["Ward", "Rate"],
				["Castle", "1"],
				["Abbey", "2"],
				["castle", "3"],
				["Nowhere", "4"],
			],
			0,
		);
		const plan = {
			kind: "choropleth",
			codeColumn: "Ward",
			valueColumn: "Rate",
			boundaryType: "ward",
			boundaryYear: 2026,
			nameToCodes: new Map([
				["castle", ["E05000001", "E05000002"]],
				["abbey", ["E05000003"]],
			]),
		} as const;

		const { dataset, report } = materialiseCustomImport(
			"dataset-4",
			document,
			plan,
		);

		expect(dataset?.data).toEqual({ E05000003: 2, Nowhere: 4 });
		expect(report).toMatchObject({
			valid: true,
			acceptedRows: 2,
			rejectedRows: 2,
		});
		expect(report.issues).toEqual([
			{
				severity: "warning",
				code: "ambiguous-name",
				message:
					"Left 2 rows off the map: 1 name is shared by more than one area.",
				rows: [2, 4],
				count: 2,
				names: ["Castle"],
			},
		]);
	});

	it("rejects a plan that refers to an absent column", () => {
		const report = validateCustomImport(
			createCsvImportDocument("rates.csv", [["Code", "Rate"]], 0),
			{
				kind: "choropleth",
				codeColumn: "Code",
				valueColumn: "Missing",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
			},
		);

		expect(report).toMatchObject({
			valid: false,
			issues: [{ code: "missing-column" }],
		});
	});
});
