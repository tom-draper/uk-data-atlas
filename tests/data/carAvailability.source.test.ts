import { describe, expect, it } from "vitest";
import { carAvailabilityStatisticsParts } from "@uk-data-atlas/datasets";
import { aggregateCarAvailability } from "@uk-data-atlas/datasets";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { APRIL_2023_LAD_MERGERS } from "@uk-data-atlas/datasets";

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

/** The part's households, by the vehicles they have, for one authority. */
const households = async (code: string, source = read) => {
	const [part] = await carAvailabilityStatisticsParts(source);
	const record = part!.records.find((candidate) => candidate.code === code)!;
	return Object.fromEntries(
		record.values.map(({ members, value }) => [
			members!["cars-or-vans"],
			value,
		]),
	);
};

describe("carAvailabilityStatisticsParts", () => {
	it("counts households by how many vehicles they have", async () => {
		const breakdown = await households("E06000001");

		expect(breakdown.noCar).toBe(250);
		expect(breakdown.oneCar).toBe(400);
		expect(breakdown.twoCars).toBe(250);
		expect(breakdown.threeOrMoreCars).toBe(100);
	});

	it("keeps the does-not-apply row out of the household total", async () => {
		const breakdown = await households("E06000001");

		expect(breakdown.total).toBe(1000);
		expect((breakdown.noCar! / breakdown.total!) * 100).toBeCloseTo(25);
	});

	it("builds the 2023 authorities the census predates by summing predecessors", async () => {
		const [part] = await carAvailabilityStatisticsParts(read);
		const breakdown = await households("E06000066");

		expect(part!.key).toBe("2021");
		expect(breakdown.noCar).toBe(
			250 * APRIL_2023_LAD_MERGERS.E06000066.predecessors.length,
		);
	});

	it("refuses to invent a merged authority from incomplete predecessors", async () => {
		const [dropped, ...rest] = ALL_PREDECESSORS;
		await expect(
			carAvailabilityStatisticsParts(async () => csvFor(rest)),
		).rejects.toThrow(`Missing car availability predecessor ${dropped}`);
	});
});

describe("aggregateCarAvailability", () => {
	it("sums households across an area, counting an authority once", async () => {
		const data = Object.fromEntries([
			[
				"E06000001",
				{
					ladCode: "E06000001",
					breakdown: {
						noCar: 250,
						oneCar: 400,
						twoCars: 250,
						threeOrMoreCars: 100,
						total: 1000,
					},
				},
			],
		]);
		const features = [
			{ properties: { LAD25CD: "E06000001" } },
			{ properties: { LAD25CD: "E06000001" } },
		];

		const { breakdown } = aggregateCarAvailability(
			collectBoundaryRecords(
				features as never,
				data,
				["LAD25CD"] as never,
				true,
			),
		);

		expect(breakdown.noCar).toBe(250);
		expect(breakdown.total).toBe(1000);
	});
});
