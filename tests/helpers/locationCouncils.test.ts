import { describe, expect, it } from "vitest";
import { locationCouncils } from "@/lib/helpers/locationCouncils";

const codes = (location: string) =>
	locationCouncils(location)?.councils.map(({ code }) => code);

describe("locationCouncils", () => {
	it("reads a city by its current council only, not its pre-2018 code", () => {
		expect(codes("Glasgow")).toEqual(["S12000049"]);
		expect(locationCouncils("Glasgow")?.councils[0]).toMatchObject({
			type: "localAuthority",
			name: "Glasgow City",
		});
	});

	it("reads a Northern Irish council place", () => {
		expect(locationCouncils("Belfast")).toMatchObject({
			initial: "N",
			councils: [{ code: "N09000003" }],
		});
	});

	it("lists a nation's councils for the nation's own place", () => {
		const scotland = codes("Scotland")!;
		expect(scotland.length).toBeGreaterThan(1);
		expect(scotland.every((code) => code.startsWith("S12"))).toBe(true);
	});

	it("leaves English, Welsh and UK places to their datasets", () => {
		expect(locationCouncils("Birmingham")).toBeNull();
		expect(locationCouncils("United Kingdom")).toBeNull();
		expect(locationCouncils(null)).toBeNull();
	});
});
