import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";

// The dataset definitions call the render recipes directly, so routing is
// checked by which recipe each definition reaches for.
vi.mock("@/lib/helpers/mapRendering", () => ({
	renderLocalElection: vi.fn(),
	renderGeneralElection: vi.fn(),
	renderCategories: vi.fn(),
	renderBrexit: vi.fn(),
	renderBrexitConstituency: vi.fn(),
	renderPopulationView: vi.fn(),
}));

import * as rendering from "@/lib/helpers/mapRendering";
import { brexitConstituencyDefinition } from "@/lib/datasets/brexitConstituency";
import { brexitDefinition } from "@/lib/datasets/brexit";
import { CATEGORY_CHART_DEFINITIONS } from "@/lib/datasets/categories";
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
		for (const definition of CATEGORY_CHART_DEFINITIONS)
			render(definition.mapRenderer, "renderCategories");
		render(brexitDefinition.mapRenderer, "renderBrexit");
		render(
			brexitConstituencyDefinition.mapRenderer,
			"renderBrexitConstituency",
		);
	});

	it.each([
		["age", "age"],
		["density", "density"],
		["gender", "gender"],
		// A link that names no view gets the primary chart, density.
		[undefined, "density"],
	] as const)(
		"routes the population %s view to the declared %s map view",
		(view, declared) => {
			render(
				populationDefinition.mapRenderer,
				"renderPopulationView",
				view,
			);
			expect(
				vi.mocked(rendering.renderPopulationView).mock.calls[0][4],
			).toMatchObject({ id: declared });
		},
	);
});
