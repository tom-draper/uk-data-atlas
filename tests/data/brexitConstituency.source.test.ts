import { describe, expect, it } from "vitest";
import { brexitConstituencyStatisticsParts } from "@uk-data-atlas/datasets";

describe("brexitConstituencyStatisticsParts", () => {
	it("keeps England while excluding Wales, Scotland and Northern Ireland", async () => {
		const [part] = await brexitConstituencyStatisticsParts(async () =>
			[
				",E14000001,English seat,,yes,,48.5",
				",W07000041,Welsh seat,,no,,52.5",
				",S14000001,Scottish seat,,yes,,55.5",
				",N06000001,Northern Irish seat,,yes,,44.5",
			].join("\n"),
		);

		expect(part!.key).toBe("2016");
		expect(part!.records.map((record) => record.code)).toEqual([
			"E14000001",
		]);
	});

	it("marks a counted seat observed and an estimated one estimated", async () => {
		const [part] = await brexitConstituencyStatisticsParts(async () =>
			[
				",E14000001,Counted seat,,yes,,48.5",
				",E14000002,Estimated seat,,no,,52.5",
			].join("\n"),
		);

		expect(part!.records.map((record) => record.values[0]!.status)).toEqual(
			["observed", "estimated"],
		);
		expect(part!.records[1]!.values[0]!.value).toBe(52.5);
	});
});
