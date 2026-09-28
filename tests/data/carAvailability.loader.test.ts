import { describe, expect, it } from "vitest";
import { loadCarAvailability } from "@/lib/data/car-availability/loader";
import { aggregateCarAvailability } from "@/lib/helpers/datasetAggregation/demographics";
import { APRIL_2023_LAD_MERGERS } from "@/lib/data/localAuthority/reorganisations";

const HEADER =
	"Lower tier local authorities Code,Lower tier local authorities,Car or van availability (5 categories) Code,Car or van availability (5 categories),Observation";

const row = (code: string, category: string, observation: number) =>
	`${code},A place,${category},A category,${observation}`;

const authority = (code: string) =>
	[
		row(code, "-8", 7), // does not apply, never a household
		row(code, "0", 250), // no car
		row(code, "1", 400), // one car
		row(code, "2", 250), // two cars
		row(code, "3", 100), // three or more
	].join("\n");

/** Every authority the 2023 mergers draw on, so the loader can build all four. */
const ALL_PREDECESSORS = Object.values(APRIL_2023_LAD_MERGERS).flatMap(
	({ predecessors }) => predecessors as readonly string[],
);

const csvFor = (codes: readonly string[]) =>
	[HEADER, ...codes.map((code) => authority(code))].join("\n");

const read = async () => csvFor(["E06000001", ...ALL_PREDECESSORS]);

describe("loadCarAvailability", () => {
	it("counts households by how many vehicles they have", async () => {
		const { breakdown } = (await loadCarAvailability(read))[2021].data
			.E06000001;

		expect(breakdown.noCar).toBe(250);
		expect(breakdown.oneCar).toBe(400);
		expect(breakdown.twoCars).toBe(250);
		expect(breakdown.threeOrMoreCars).toBe(100);
	});

	it("keeps the does-not-apply row out of the household total", async () => {
		const { breakdown } = (await loadCarAvailability(read))[2021].data
			.E06000001;

		expect(breakdown.total).toBe(1000);
		expect((breakdown.noCar / breakdown.total) * 100).toBeCloseTo(25);
	});

	it("builds the 2023 authorities the census predates by summing predecessors", async () => {
		const datasets = await loadCarAvailability(read);
		const somerset = datasets[2021].data.E06000066;

		expect(somerset.breakdown.noCar).toBe(
			250 * APRIL_2023_LAD_MERGERS.E06000066.predecessors.length,
		);
		expect(datasets[2021]).toMatchObject({
			id: "carAvailability2021",
			type: "carAvailability",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
		});
	});

	it("refuses to invent a merged authority from incomplete predecessors", async () => {
		const [dropped, ...rest] = ALL_PREDECESSORS;
		await expect(
			loadCarAvailability(async () => csvFor(rest)),
		).rejects.toThrow(`Missing car availability predecessor ${dropped}`);
	});
});

describe("aggregateCarAvailability", () => {
	it("sums households across an area, counting an authority once", async () => {
		const datasets = await loadCarAvailability(read);
		const features = [
			{ properties: { LAD25CD: "E06000001" } },
			{ properties: { LAD25CD: "E06000001" } },
		];

		const { breakdown } = aggregateCarAvailability(
			features as never,
			["LAD25CD"] as never,
			datasets[2021].data,
		);

		expect(breakdown.noCar).toBe(250);
		expect(breakdown.total).toBe(1000);
	});
});
