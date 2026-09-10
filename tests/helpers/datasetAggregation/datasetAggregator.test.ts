import { describe, expect, it, vi } from "vitest";
import { DatasetAggregator } from "@/lib/helpers/datasetAggregation";
import type {
	AggregationCache,
	BoundaryAggregationSpec,
	BoundaryCodeDetector,
} from "@/lib/helpers/datasetAggregation/ports";
import type { BoundaryGeojson } from "@/lib/types";
import { CODE_KEY, features } from "./fixtures";

const geojson = {
	type: "FeatureCollection",
	crs: { type: "name", properties: { name: "EPSG:4326" } },
	features: features(["E1", "E2"]),
} as BoundaryGeojson;

const cache = (): AggregationCache => {
	const values = new Map<string, unknown>();
	return {
		get: (key) => values.get(key),
		set: (key, value) => values.set(key, value),
	};
};

describe("DatasetAggregator", () => {
	it("applies a specification with the detected code property and caches by context", () => {
		const detect = vi.fn(() => CODE_KEY);
		const aggregate = vi.fn<
			BoundaryAggregationSpec<Record<string, number>, number>["aggregate"]
		>((features, codeProp, data) =>
			features.reduce(
				(total, feature) =>
					total +
					data[
						(
							feature.properties as unknown as Record<
								string,
								string
							>
						)[codeProp]
					],
				0,
			),
		);
		const specification: BoundaryAggregationSpec<
			Record<string, number>,
			number
		> = {
			cacheKey: "example",
			scope: "localAuthority",
			aggregate,
		};
		const aggregator = new DatasetAggregator(
			{ detect } as BoundaryCodeDetector,
			cache(),
		);

		expect(
			aggregator.aggregate(
				specification,
				geojson,
				{ E1: 2, E2: 3 },
				"Leeds",
				"2025",
			),
		).toBe(5);
		expect(
			aggregator.aggregate(
				specification,
				geojson,
				{ E1: 9, E2: 9 },
				"Leeds",
				"2025",
			),
		).toBe(5);

		expect(detect).toHaveBeenCalledTimes(1);
		expect(detect).toHaveBeenCalledWith("localAuthority", geojson.features);
		expect(aggregate).toHaveBeenCalledTimes(1);
		expect(aggregate).toHaveBeenCalledWith(geojson.features, CODE_KEY, {
			E1: 2,
			E2: 3,
		});
	});
});
