import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";

// The dataset definitions call the render recipes directly, so routing is
// checked by which recipe each definition reaches for.
vi.mock("@/lib/helpers/mapRendering", () => ({
	renderLocalElection: vi.fn(),
	renderGeneralElection: vi.fn(),
	renderEthnicity: vi.fn(),
	renderBrexit: vi.fn(),
	renderBrexitConstituency: vi.fn(),
	renderAgeDistribution: vi.fn(),
	renderGender: vi.fn(),
	renderPopulationDensity: vi.fn(),
}));

import * as rendering from "@/lib/helpers/mapRendering";
import { brexitConstituencyDefinition } from "@/lib/datasets/brexitConstituency";
import { brexitDefinition } from "@/lib/datasets/brexit";
import { ethnicityDefinition } from "@/lib/datasets/ethnicity";
import { generalElectionDefinition } from "@/lib/datasets/generalElection";
import { localElectionDefinition } from "@/lib/datasets/localElection";
import { populationDefinition } from "@/lib/datasets/population";
import type { ChartDatasetMapRenderer } from "@/lib/datasets";
import type { VizView } from "@/lib/types/datasets";

const map = { codeProp: vi.fn(), transformed: vi.fn() } as never;

const render = (
	renderer: ChartDatasetMapRenderer<never> | undefined,
	recipe: keyof typeof rendering,
	view?: VizView,
) => {
	const recipeMock = vi.mocked(
		rendering[recipe] as (context: unknown) => void,
	);
	recipeMock.mockClear();
	renderer?.render({
		map,
		geojson: {} as never,
		dataset: {} as never,
		mapOptions: DEFAULT_MAP_OPTIONS,
		activeViz: {
			datasetId: "population2022",
			view,
			datasetType: "population",
			datasetYear: 2022,
		},
		isDark: true,
	});
	expect(recipeMock).toHaveBeenCalledOnce();
	// The recipe is always handed the map context, never the map session.
	expect(recipeMock.mock.calls[0][0]).toBe(map);
};

describe("chart map renderers", () => {
	it("routes categorical datasets to their own recipes", () => {
		render(generalElectionDefinition.mapRenderer, "renderGeneralElection");
		render(localElectionDefinition.mapRenderer, "renderLocalElection");
		render(ethnicityDefinition.mapRenderer, "renderEthnicity");
		render(brexitDefinition.mapRenderer, "renderBrexit");
		render(
			brexitConstituencyDefinition.mapRenderer,
			"renderBrexitConstituency",
		);
	});

	it("routes population visualisations by the active view", () => {
		render(
			populationDefinition.mapRenderer,
			"renderAgeDistribution",
			"age",
		);
		render(
			populationDefinition.mapRenderer,
			"renderPopulationDensity",
			"density",
		);
		render(populationDefinition.mapRenderer, "renderGender", "gender");
	});

	it("falls back to the primary chart when a link names no view", () => {
		render(populationDefinition.mapRenderer, "renderPopulationDensity");
	});
});
