import { describe, expect, it } from "vitest";
import {
	aggregateMobileCoverage,
	type DatasetReader,
} from "@uk-data-atlas/datasets";
import { mobileCoverage } from "../../packages/datasets/src/infrastructure/digital-connectivity/mobile-coverage/dataset.ts";

const csv = [
	"laua,laua_name,prem_count,4G_prem_in_0,4G_prem_in_4,4G_geo_out_4,5G_high_confidence_prem_out_0,5G_high_confidence_prem_out_4,5G_high_confidence_geo_out_0",
	"E06000001,Hartlepool,100000,0.31,96.56,88.20,9.69,40.00,20.00",
	"E06000002,Middlesbrough,50000,,88.00,80.00,,10.00,30.00",
	"XX0000001,Not a local authority,1000,1,1,1,1,1,1",
].join("\n");

describe("mobile coverage source reader", () => {
	it("reads operator coverage and treats blank zero buckets as zero", async () => {
		const [part] = await mobileCoverage.statistics.direct!.read({
			text: async () => csv,
		} as unknown as DatasetReader);
		expect(part.records.map(({ code }) => code)).toEqual([
			"E06000001",
			"E06000002",
		]);
		const [first, second] = part.records;
		const value = (
			record: typeof first,
			technology: string,
			location: string,
			operators: string,
		) =>
			record.values.find(
				(item) =>
					item.members?.["mobile-technology"] === technology &&
					item.members?.["coverage-location"] === location &&
					item.members?.["mobile-operators"] === operators,
			)?.value;
		expect(value(first, "4g", "indoor", "all")).toBe(96.56);
		expect(value(first, "4g", "indoor", "any")).toBe(99.69);
		expect(value(first, "5g", "outdoor", "any")).toBe(90.31);
		expect(value(second, "4g", "indoor", "any")).toBe(100);
	});
});

describe("aggregateMobileCoverage", () => {
	it("weights premises shares by premises count", () => {
		const records = [
			{
				ladCode: "E06000001",
				ladName: "Hartlepool",
				premisesCount: 100000,
				pct4GIndoorAll: 96.56,
				pct4GGeoAll: 88.2,
				pct4GIndoorAny: 99.69,
				pct5GOutdoorAll: 40,
				pct5GOutdoorAny: 90.31,
				pct5GGeoAny: 80,
			},
			{
				ladCode: "E06000002",
				ladName: "Middlesbrough",
				premisesCount: 50000,
				pct4GIndoorAll: 88,
				pct4GGeoAll: 80,
				pct4GIndoorAny: 100,
				pct5GOutdoorAll: 10,
				pct5GOutdoorAny: 100,
				pct5GGeoAny: 70,
			},
		];
		const aggregated = aggregateMobileCoverage(records);
		expect(aggregated?.pct4GIndoorAll).toBeCloseTo(93.71, 2);
		expect(aggregated?.pct4GGeoAll).toBeCloseTo(84.1);
		expect(aggregateMobileCoverage([])).toBeNull();
	});
});
