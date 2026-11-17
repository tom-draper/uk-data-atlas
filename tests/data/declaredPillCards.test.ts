import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definitionOf = (type: string) =>
	CHART_DATASET_DEFINITIONS.find((candidate) => candidate.type === type)!;

const cardFor = (
	type: "air-quality" | "broadband" | "mobile-coverage",
	measure: string,
) =>
	definitionOf(type).chart.cardForOptions!({
		...DEFAULT_MAP_OPTIONS,
		[type]: { ...DEFAULT_MAP_OPTIONS[type], measure },
	} as MapOptions);

const dataset = (record: Record<string, unknown>) =>
	({ data: { E1: record } }) as never;

describe("pill cards", () => {
	it.each(["air-quality", "broadband", "mobile-coverage"] as const)(
		"%s is drawn by the shared value card",
		(type) => {
			expect(definitionOf(type).chart.componentPath).toContain(
				"ValueCard",
			);
			expect(
				cardFor(type, DEFAULT_MAP_OPTIONS[type].measure).layout,
			).toBe("pills");
		},
	);

	it("shows the chosen pollutant with the particulate pills", () => {
		const record = { no2Mean: 12.34, pm25Mean: 8.2, pm10Mean: 14 };
		const stats = cardFor("air-quality", "pm25").fromRecord(
			dataset(record),
			"E1",
		);
		expect(stats?.value).toBe(8.2);
		expect(stats?.pills).toEqual([
			{ label: "PM2.5", value: 8.2, unit: "µg/m³", digits: 1 },
			{ label: "PM10", value: 14, unit: "µg/m³", digits: 1 },
		]);
		expect(cardFor("air-quality", "no2").fromAggregate(record)?.value).toBe(
			12.34,
		);
	});

	it("names the broadband tier in the heading and keeps three tiers beside it", () => {
		const record = {
			pctFullFibre: 60,
			pctSuperfast: 97,
			pctUltrafast: 80,
			pctGigabit: 75,
		};
		const card = cardFor("broadband", "fullFibre");
		expect(card.heading).toBe("Full Fibre Broadband");
		const stats = card.fromAggregate(record);
		expect(stats?.value).toBe(60);
		expect(stats?.pills?.map((pill) => pill.value)).toEqual([97, 80, 75]);
	});

	it("notes 5G on any operator except on landmass measures", () => {
		const record = {
			pct5GOutdoorAll: 20,
			pct5GOutdoorAny: 55.6,
			pct4GIndoorAll: 70,
			pct4GGeoAll: 40,
			pct5GGeoAny: 30,
		};
		expect(
			cardFor("mobile-coverage", "pct4GIndoorAll").fromRecord(
				dataset(record),
				"E1",
			)?.secondary,
		).toBe("55.6% 5G on at least one");
		expect(
			cardFor("mobile-coverage", "pct4GGeoAll").fromRecord(
				dataset(record),
				"E1",
			)?.secondary,
		).toBeUndefined();
		expect(
			cardFor("mobile-coverage", "pct4GGeoAll")
				.fromRecord(dataset(record), "E1")
				?.pills?.map((pill) => pill.label),
		).toEqual(["4G in", "4G land"]);
	});
});
