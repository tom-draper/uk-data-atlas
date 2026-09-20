import { describe, expect, it } from "vitest";
import {
	activeVizFromReference,
	parseVisualizationRef,
	visualizationRefFromActiveViz,
} from "@/lib/helpers/visualization";

describe("visualization references", () => {
	it("uses the public dataset, period, and view tuple", () => {
		const reference = parseVisualizationRef(
			new URLSearchParams("dataset=population&period=2022&view=age"),
		);

		expect(reference).toEqual({
			dataset: "population",
			period: 2022,
			view: "age",
		});
		expect(activeVizFromReference(reference!)).toEqual({
			datasetId: "population2022",
			datasetType: "population",
			datasetYear: 2022,
			view: "age",
		});
	});

	it("does not accept the removed viz, type, and year parameters", () => {
		expect(
			parseVisualizationRef(
				new URLSearchParams(
					"viz=localElection2024&type=localElection&year=2024",
				),
			),
		).toBeNull();
	});

	it("only accepts views registered for the selected dataset", () => {
		expect(
			parseVisualizationRef(
				new URLSearchParams(
					"dataset=local-election&period=2024&view=age",
				),
			),
		).toBeNull();
	});

	it("maps the internal registry selection back to kebab-case", () => {
		expect(
			visualizationRefFromActiveViz({
				datasetId: "localElection2024",
				datasetType: "localElection",
				datasetYear: 2024,
			}),
		).toEqual({ dataset: "local-election", period: 2024 });
	});
});
