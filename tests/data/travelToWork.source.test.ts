import { describe, expect, it } from "vitest";
import { travelToWorkStatisticsParts } from "@uk-data-atlas/datasets";
import { aggregateTravelToWork } from "@uk-data-atlas/datasets";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { APRIL_2023_LAD_MERGERS } from "@uk-data-atlas/datasets";

const HEADER =
	"Lower tier local authorities Code,Lower tier local authorities,Method used to travel to workplace (12 categories) Code,Method used to travel to workplace (12 categories),Observation";

const row = (code: string, category: string, observation: number) =>
	`${code},A place,${category},A method,${observation}`;

/** One authority with a value in every category, including the excluded one. */
const authority = (code: string, scale = 1) =>
	[
		row(code, "1", 100 * scale), // work from home
		row(code, "2", 10 * scale), // metro
		row(code, "3", 20 * scale), // train
		row(code, "4", 30 * scale), // bus
		row(code, "5", 5 * scale), // taxi
		row(code, "6", 5 * scale), // motorcycle
		row(code, "7", 200 * scale), // driving
		row(code, "8", 50 * scale), // passenger
		row(code, "9", 25 * scale), // bicycle
		row(code, "10", 50 * scale), // on foot
		row(code, "11", 5 * scale), // other
		row(code, "12", 9999 * scale), // not in employment
	].join("\n");

/** Every authority the 2023 mergers draw on, so the loader can build all four. */
const ALL_PREDECESSORS = Object.values(APRIL_2023_LAD_MERGERS).flatMap(
	({ predecessors }) => predecessors as readonly string[],
);

const csvFor = (codes: readonly string[]) =>
	[HEADER, ...codes.map((code) => authority(code))].join("\n");

const csv = csvFor(["E06000001", ...ALL_PREDECESSORS]);

const read = async () => csv;

/** The part's people in employment, by travel mode, for one authority. */
const people = async (code: string) => {
	const [part] = await travelToWorkStatisticsParts(read);
	const record = part!.records.find((candidate) => candidate.code === code)!;
	return Object.fromEntries(
		record.values.map(({ members, value }) => [
			members!["travel-method"],
			value,
		]),
	);
};

describe("travelToWorkStatisticsParts", () => {
	it("folds the census categories into travel modes", async () => {
		const breakdown = await people("E06000001");

		expect(breakdown.workFromHome).toBe(100);
		// Metro, train and bus are three categories but one mode.
		expect(breakdown.publicTransport).toBe(60);
		// Driving and being a passenger are counted apart by the census.
		expect(breakdown.car).toBe(250);
		expect(breakdown.bicycle).toBe(25);
	});

	it("counts shares against people in employment, not everyone", async () => {
		const breakdown = await people("E06000001");

		// 100 + 60 + 250 + 5 + 5 + 25 + 50 + 5, with the 9,999 not in
		// employment left out.
		expect(breakdown.total).toBe(500);
		expect((breakdown.car! / breakdown.total!) * 100).toBeCloseTo(50);
	});

	it("builds the 2023 authorities the census predates by summing predecessors", async () => {
		const [part] = await travelToWorkStatisticsParts(read);
		const breakdown = await people("E06000066");

		expect(part!.key).toBe("2021");
		expect(breakdown.car).toBe(
			250 * APRIL_2023_LAD_MERGERS.E06000066.predecessors.length,
		);
	});

	it("refuses to invent a merged authority from incomplete predecessors", async () => {
		const [dropped, ...rest] = ALL_PREDECESSORS;
		await expect(
			travelToWorkStatisticsParts(async () => csvFor(rest)),
		).rejects.toThrow(`Missing travel to work predecessor ${dropped}`);
	});
});

describe("aggregateTravelToWork", () => {
	it("sums each mode across an area, counting an authority once", async () => {
		const data = {
			E06000001: {
				ladCode: "E06000001",
				breakdown: {
					workFromHome: 100,
					publicTransport: 60,
					car: 250,
					taxi: 5,
					motorcycle: 5,
					bicycle: 25,
					onFoot: 50,
					other: 5,
					total: 500,
				},
			},
		};
		const features = [
			{ properties: { LAD25CD: "E06000001" } },
			{ properties: { LAD25CD: "E06000001" } },
		];

		const { breakdown } = aggregateTravelToWork(
			collectBoundaryRecords(
				features as never,
				data,
				["LAD25CD"] as never,
				true,
			),
		);

		expect(breakdown.car).toBe(250);
		expect(breakdown.total).toBe(500);
	});
});
