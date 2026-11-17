import { describe, expect, it } from "vitest";
import {
	housePrice,
	statisticsOf,
	themeOfTopic,
} from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";

describe("house price declaration", () => {
	it("is a housing dataset whose edition carries its id as its type", () => {
		expect(housePrice.id).toBe("house-price");
		expect(themeOfTopic(housePrice.topic)).toBe("housing");
		const payload = statisticsOf(housePrice).payload!;
		const parts =
			typeof payload.parts === "function"
				? payload.parts(["2023"])
				: payload.parts;
		expect(parts.length).toBeGreaterThan(0);
		for (const part of parts) expect(part.header.type).toBe("house-price");
	});

	it("draws its card, map and options from its declaration", () => {
		const definition = CHART_DATASET_DEFINITIONS.find(
			(candidate) => candidate.type === "house-price",
		);
		expect(definition?.chart.key).toBe("housing-house-price");
		expect(definition?.chart.componentPath).toBe(
			"@/components/measures/MeasureSeriesChart",
		);
		expect(DEFAULT_MAP_OPTIONS["house-price"].measure).toBe("median");
	});
});
