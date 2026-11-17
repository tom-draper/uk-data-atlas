import { describe, expect, it } from "vitest";
import { latestPoint, numericPoints, sparkline } from "@/lib/measures/series";

describe("numericPoints", () => {
	it("keeps only periods that carry a number", () => {
		expect(
			numericPoints([
				{ period: "2020", value: 1 },
				{ period: "2021", value: null },
				{ period: "2022", value: Number.NaN },
				{ period: "2023", value: 4 },
			]),
		).toEqual([
			{ period: "2020", value: 1 },
			{ period: "2023", value: 4 },
		]);
	});
});

describe("latestPoint", () => {
	it("is the last period with a value", () => {
		expect(
			latestPoint([
				{ period: "2022", value: 3 },
				{ period: "2023", value: 5 },
				{ period: "2024", value: null },
			]),
		).toEqual({ period: "2023", value: 5 });
	});

	it("is null when no period has a value", () => {
		expect(latestPoint([{ period: "2023", value: null }])).toBeNull();
		expect(latestPoint([])).toBeNull();
	});
});

describe("sparkline", () => {
	it("draws nothing for fewer than two values", () => {
		expect(sparkline([])).toBeNull();
		expect(sparkline([4])).toBeNull();
	});

	it("runs left to right and puts higher values higher up", () => {
		const line = sparkline([0, 10], { domain: [0, 10] })!;
		expect(line.linePath).toBe("M 0,100 L 100,0");
		expect(line.last).toEqual({ x: 100, y: 0 });
		expect(line.areaPath).toBe("M 0,100 L 100,0 L 100,100 L 0,100 Z");
	});

	it("leaves padding above and below", () => {
		const line = sparkline([0, 10], { domain: [0, 10], padY: 12 })!;
		expect(line.linePath).toBe("M 0,88 L 100,12");
	});

	it("holds values outside a fixed domain at its edge", () => {
		const line = sparkline([-5, 20], { domain: [0, 10] })!;
		expect(line.linePath).toBe("M 0,100 L 100,0");
	});

	it("reaches past the data by a margin and never below zero", () => {
		const line = sparkline([1, 2], { margin: 0.3 })!;
		// range is 0.7 to 2.3, so 1 sits at 0.3/1.6 up and 2 at 1.3/1.6 up
		const [first, second] = line.linePath
			.replace("M ", "")
			.split(" L ")
			.map((point) => Number(point.split(",")[1]));
		expect(first).toBeCloseTo(100 - (0.3 / 1.6) * 100, 6);
		expect(second).toBeCloseTo(100 - (1.3 / 1.6) * 100, 6);
		const near = sparkline([0.1, 5], { margin: 0.3 })!;
		expect(near.linePath.startsWith("M 0,")).toBe(true);
		expect(Number(near.linePath.split(",")[1]!.split(" ")[0])).toBeCloseTo(
			100 - (0.1 / 5.3) * 100,
			6,
		);
	});

	it("draws a flat series in the middle", () => {
		const line = sparkline([5, 5, 5], { margin: 0 })!;
		expect(line.linePath).toBe("M 0,50 L 50,50 L 100,50");
	});
});
