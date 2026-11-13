import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { formatDisplay } from "@/lib/datasets/declared";
import type { MapOptions } from "@/lib/types/mapOptions";

const definitionOf = (type: string) =>
	CHART_DATASET_DEFINITIONS.find((definition) => definition.type === type)!;

const withMeasure = (type: string, measure: string): MapOptions => {
	const options = DEFAULT_MAP_OPTIONS as unknown as Record<string, object>;
	return {
		...DEFAULT_MAP_OPTIONS,
		[type]: { ...options[type], measure },
	} as MapOptions;
};

describe("declared number formats", () => {
	it("writes money in millions as millions below a billion and billions above", () => {
		const money = { kind: "millions", prefix: "£" } as const;
		expect(formatDisplay(money, 340)).toBe("£340m");
		expect(formatDisplay(money, 999.6)).toBe("£1000m");
		expect(formatDisplay(money, 1_250)).toBe("£1.3bn");
		expect(formatDisplay({ ...money, suffix: " GVA" }, 2_000)).toBe(
			"£2.0bn GVA",
		);
	});

	it("rounds a count first when asked to", () => {
		expect(
			formatDisplay(
				{ kind: "count", prefix: "£", round: true },
				32_499.6,
			),
		).toBe("£32,500");
	});
});

describe("workplace-income", () => {
	const definition = definitionOf("workplace-income");
	const record = {
		annual: { median: 31_250.4, mean: 36_000 },
		hourly: { median: 15.256, mean: 17 },
	};
	const dataset = { data: { E1: record } };

	it("reads each period and statistic from the record", () => {
		for (const [measure, value] of [
			["annualMedian", 31_250.4],
			["annualMean", 36_000],
			["hourlyMedian", 15.256],
			["hourlyMean", 17],
		] as const)
			expect(
				definition.map!.valueFor!(
					dataset as never,
					"E1",
					withMeasure("workplace-income", measure),
				),
			).toBe(value);
		expect(
			definition.map!.valueFor!(
				dataset as never,
				"missing",
				DEFAULT_MAP_OPTIONS,
			),
		).toBeNull();
	});

	it("writes annual pay in whole pounds and hourly pay to the penny", () => {
		const annual = withMeasure("workplace-income", "annualMedian");
		const hourly = withMeasure("workplace-income", "hourlyMedian");
		expect(definition.map!.legend.format(31_250, annual)).toBe("£31250");
		expect(definition.map!.legend.format(15.256, hourly)).toBe(
			"£15.26/hour",
		);
		expect(definition.map!.legend.bounds!(hourly)).toEqual({
			min: 0,
			max: 60,
		});
		expect(
			definition.chart.cardForOptions!(annual).fromRecord(dataset, "E1"),
		).toEqual({
			value: 31_250.4,
			secondary: "Regional values average available authority estimates",
		});
	});

	it("keeps the chart card as the centred income card", () => {
		const card = definition.chart.cardForOptions!(DEFAULT_MAP_OPTIONS);
		expect(card).toMatchObject({
			background: "income",
			layout: "centered",
			accent: "#10b981",
			unit: "per year",
		});
		expect(card.format!(32_499.6)).toBe("£32,500");
		expect(
			definition.chart.cardForOptions!(
				withMeasure("workplace-income", "hourlyMean"),
			).format!(17),
		).toBe("£17.00/hour");
	});
});

describe("planning-applications", () => {
	const definition = definitionOf("planning-applications");
	const dataset = {
		data: {
			E1: {
				code: "E1",
				name: "One",
				value: 100,
				metrics: { decided: 80 },
			},
		},
	};

	it("reads received from the value and the other stages from metrics", () => {
		const read = (measure: string) =>
			definition.map!.valueFor!(
				dataset as never,
				"E1",
				withMeasure("planning-applications", measure),
			);
		expect(read("received")).toBe(100);
		expect(read("decided")).toBe(80);
		expect(read("withdrawn")).toBeNull();
	});

	it("names the stage under the headline and groups the legend's digits", () => {
		const decided = withMeasure("planning-applications", "decided");
		expect(definition.chart.cardForOptions!(decided).unit).toBe(
			"Applications decided",
		);
		expect(definition.map!.legend.format(1_500, decided)).toBe("1,500");
	});
});

describe("regional-gdp", () => {
	const definition = definitionOf("regional-gdp");

	it("writes the card and legend in pounds, headed by the chosen measure", () => {
		const gva = withMeasure("regional-gdp", "gva");
		const gdp = withMeasure("regional-gdp", "gdp");
		expect(definition.chart.cardForOptions!(gva).heading).toBe(
			"Regional GVA",
		);
		expect(definition.chart.cardForOptions!(gdp).heading).toBe(
			"Regional GDP",
		);
		expect(definition.chart.cardForOptions!(gdp).format!(2_200)).toBe(
			"£2.2bn",
		);
		expect(definition.map!.legend.format(340, gva)).toBe("£340m GVA");
		expect(definition.map!.legend.format(2_200, gdp)).toBe("£2.2bn GDP");
	});
});
