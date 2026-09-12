import { describe, expect, it } from "vitest";
import { loadMobileCoverage } from "@/lib/data/mobile-coverage/loader";
import { aggregateMobileCoverage } from "@/lib/helpers/datasetAggregation/numeric";

// The published columns are percentages of premises, or of landmass, reached by
// exactly that many operators; each family sums to 100.
const header = [
	"laua",
	"laua_name",
	"prem_count",
	"4G_prem_in_0",
	"4G_prem_in_4",
	"4G_geo_out_4",
	"5G_high_confidence_prem_out_0",
	"5G_high_confidence_prem_out_4",
	"5G_high_confidence_geo_out_0",
].join(",");

const csv = [
	header,
	"E06000001,Hartlepool,100000,0.31,96.56,88.20,9.69,40.00,20.00",
	// Ofcom leaves the zero bucket blank rather than writing 0.
	"E06000002,Middlesbrough,50000,,88.00,80.00,,10.00,30.00",
	"XX0000001,Not a local authority,1000,1,1,1,1,1,1",
].join("\n");

const read = async () => csv;

describe("loadMobileCoverage", () => {
	it("reads the operator-count columns as percentages", async () => {
		const datasets = await loadMobileCoverage(read);
		const hartlepool = datasets[2025].data.E06000001;

		expect(hartlepool.pct4GIndoorAll).toBeCloseTo(96.56);
		expect(hartlepool.pct5GOutdoorAll).toBeCloseTo(40);
		expect(hartlepool.pct4GGeoAll).toBeCloseTo(88.2);
	});

	it("derives the at-least-one share from the zero bucket", async () => {
		const datasets = await loadMobileCoverage(read);

		expect(datasets[2025].data.E06000001.pct4GIndoorAny).toBe(99.69);
		// 100 - 9.69 without a floating-point tail.
		expect(datasets[2025].data.E06000001.pct5GOutdoorAny).toBe(90.31);
	});

	it("treats a blank zero bucket as full coverage, not missing data", async () => {
		const datasets = await loadMobileCoverage(read);
		const middlesbrough = datasets[2025].data.E06000002;

		expect(middlesbrough.pct4GIndoorAny).toBe(100);
		expect(middlesbrough.pct5GOutdoorAny).toBe(100);
	});

	it("skips rows that are not a local authority", async () => {
		const datasets = await loadMobileCoverage(read);

		expect(Object.keys(datasets[2025].data)).toEqual([
			"E06000001",
			"E06000002",
		]);
		expect(datasets[2025]).toMatchObject({
			id: "mobileCoverage2025",
			type: "mobileCoverage",
			boundaryType: "localAuthority",
			boundaryYear: 2024,
		});
	});
});

describe("aggregateMobileCoverage", () => {
	it("weights premises shares by how many premises an authority holds", async () => {
		const datasets = await loadMobileCoverage(read);
		const aggregated = aggregateMobileCoverage(
			Object.values(datasets[2025].data),
		);

		// (96.56 x 100000 + 88 x 50000) / 150000, not the flat mean of 92.28.
		expect(aggregated?.pct4GIndoorAll).toBeCloseTo(93.71, 2);
		// Landmass has no premises weight, so it stays a plain mean.
		expect(aggregated?.pct4GGeoAll).toBeCloseTo(84.1);
	});

	it("reports nothing for an area with no authorities", () => {
		expect(aggregateMobileCoverage([])).toBeNull();
	});
});
