import { describe, expect, it } from "vitest";
import {
	atlasStateFromParams,
	DEFAULT_ACTIVE_VIZ,
	DEFAULT_LOCATION,
} from "@/lib/hooks/useAtlasUrlState";

describe("atlas URL state", () => {
	it("uses the documented defaults when parameters are absent", () => {
		expect(atlasStateFromParams(new URLSearchParams())).toEqual({
			activeViz: DEFAULT_ACTIVE_VIZ,
			selectedLocation: DEFAULT_LOCATION,
		});
	});

	it("parses a shared location and visualization", () => {
		expect(
			atlasStateFromParams(
				new URLSearchParams(
					"location=North%20Wales&dataset=population&period=2022&view=age",
				),
			),
		).toEqual({
			activeViz: {
				datasetId: "population2022",
				datasetType: "population",
				datasetYear: 2022,
				view: "age",
			},
			selectedLocation: "North Wales",
		});
	});

	it("falls back when a visualization reference is invalid", () => {
		expect(
			atlasStateFromParams(
				new URLSearchParams("dataset=population&period=not-a-year"),
			),
		).toEqual({
			activeViz: DEFAULT_ACTIVE_VIZ,
			selectedLocation: DEFAULT_LOCATION,
		});
	});
});
