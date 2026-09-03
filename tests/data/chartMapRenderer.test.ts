import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { brexitConstituencyDefinition } from "@/lib/datasets/brexitConstituency";
import { brexitDefinition } from "@/lib/datasets/brexit";
import { ethnicityDefinition } from "@/lib/datasets/ethnicity";
import { generalElectionDefinition } from "@/lib/datasets/generalElection";
import { localElectionDefinition } from "@/lib/datasets/localElection";
import { populationDefinition } from "@/lib/datasets/population";
import type { ChartDatasetMapRenderer } from "@/lib/datasets";

const render = (
	renderer: ChartDatasetMapRenderer<any> | undefined,
	method: string,
	datasetId: string,
	view?: "age" | "density" | "gender",
) => {
	const update = vi.fn();
	renderer?.render({
		mapManager: { [method]: update } as never,
		geojson: {} as never,
		dataset: {} as never,
		mapOptions: DEFAULT_MAP_OPTIONS,
		activeViz: { datasetId, view, datasetType: "population", datasetYear: 2022 },
		isDark: true,
	});
	expect(update).toHaveBeenCalledOnce();
};

describe("chart map renderers", () => {
	it("routes categorical datasets through their specialised map managers", () => {
		render(generalElectionDefinition.mapRenderer, "updateMapForGeneralElection", "generalElection-2024");
		render(localElectionDefinition.mapRenderer, "updateMapForLocalElection", "localElection-2025");
		render(ethnicityDefinition.mapRenderer, "updateMapForEthnicity", "demographics-ethnicity");
		render(brexitDefinition.mapRenderer, "updateMapForBrexit", "brexit-electoral");
		render(brexitConstituencyDefinition.mapRenderer, "updateMapForBrexitConstituency", "brexit-hanretty");
	});

	it("routes population visualisations by the active view", () => {
		render(populationDefinition.mapRenderer, "updateMapForAgeDistribution", "population2022", "age");
		render(populationDefinition.mapRenderer, "updateMapForPopulationDensity", "population2022", "density");
		render(populationDefinition.mapRenderer, "updateMapForGender", "population2022", "gender");
	});

	it("falls back to the primary chart when a link names no view", () => {
		render(populationDefinition.mapRenderer, "updateMapForPopulationDensity", "population2022");
	});
});
