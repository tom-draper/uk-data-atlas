import { describe, expect, it } from "vitest";
import { getSequentialColorForValue } from "@/lib/helpers/colorScale/datasetColors";
import { FeatureBuilder } from "@/lib/helpers/mapManager/featureBuilder";

describe("FeatureBuilder point colours", () => {
	it("samples the active heatmap theme from low to high point values", () => {
		const points = [
			{ lng: -1, lat: 51, value: 1 },
			{ lng: -1, lat: 52, value: 2 },
			{ lng: -1, lat: 53, value: 3 },
		];
		const collection = new FeatureBuilder().buildPointCollection(
			points,
			1,
			3,
			"viridis",
		);

		expect(
			collection.features.map((feature) => feature.properties?.color),
		).toEqual(
			points.map((point) =>
				getSequentialColorForValue(
					point.value,
					{ min: 1, max: 3 },
					"viridis",
				),
			),
		);
	});
});
