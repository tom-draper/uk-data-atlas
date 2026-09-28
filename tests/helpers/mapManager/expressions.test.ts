import { describe, expect, it } from "vitest";
import {
	categoryMatch,
	hoverOpacity,
	linearInterpolate,
	featureProperty,
	zoomInterpolate,
} from "@/lib/helpers/mapManager/expressions";

describe("MapLibre expression helpers", () => {
	it("builds a category match expression", () => {
		expect(categoryMatch("party", [["LAB", "#f00"]], "#ccc")).toEqual([
			"match",
			["get", "party"],
			"LAB",
			"#f00",
			"#ccc",
		]);
	});

	it("builds reusable hover and interpolation expressions", () => {
		expect(hoverOpacity(0.6)).toEqual([
			"case",
			["boolean", ["feature-state", "hover"], false],
			0.348,
			0.6,
		]);
		expect(
			linearInterpolate(featureProperty("value"), [
				[0, "#000"],
				[1, "#fff"],
			]),
		).toEqual([
			"interpolate",
			["linear"],
			["get", "value"],
			0,
			"#000",
			1,
			"#fff",
		]);
		expect(
			zoomInterpolate([
				[6, 0],
				[9, 1],
			]),
		).toEqual(["interpolate", ["linear"], ["zoom"], 6, 0, 9, 1]);
	});
});
