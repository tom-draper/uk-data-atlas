import { describe, expect, it } from "vitest";
import { APRIL_2023_LAD_MERGERS } from "@uk-data-atlas/datasets";
import {
	annualPeriod,
	unemploymentStatisticsPart,
} from "@uk-data-atlas/datasets";

// The loader builds the April 2023 authorities, so their districts are needed.
const districts = Object.values(APRIL_2023_LAD_MERGERS).flatMap(
	({ predecessors }) => predecessors,
);

// The layout of the M01 local authority sheets: title rows, then period
// headers with each value's confidence interval in the column after it, and
// rolling quarterly periods between the annual ones.
const sheet = (kind: "Rate" | "Level", rows: string[]) =>
	[
		"Model-based estimates of unemployment,,,,,,,,,",
		",,,,,,,,,",
		"UALAD,,,2003/04,,,Apr 2004 to Mar 2005,,,Jan 2004 to Dec 2004,,",
		`,,,${kind},+/-,,${kind},+/-,,${kind},+/-,`,
		",,,,,,,,,",
		...rows,
	].join("\n");

const rates = sheet("Rate", [
	"Fife,S12000015,,6.56,1.2,,6.1,1.1,,5.96,1.1,",
	"Buckinghamshire,E06000060,,:,:,,:,:,,3.6,..,",
	...districts.map((code) => `District,${code},,5,1,,5,1,,5,1,`),
]);
const levels = sheet("Level", [
	"Fife,S12000015,,11000,2000,,10500,2000,,10000,1900,",
	"Buckinghamshire,E06000060,,:,:,,:,:,,10000,..,",
	...districts.map((code) => `District,${code},,500,100,,500,100,,500,100,`),
]);

const read = async (_path: string, name: string) =>
	name === "LA,UA Rates" ? rates : levels;

describe("loadUnemployment", () => {
	it("labels financial and calendar years and skips rolling periods", () => {
		expect(annualPeriod("1996/97")).toEqual({
			year: 1996,
			label: "April 1996 to March 1997",
		});
		expect(annualPeriod("Jan 2004 to Dec 2004")).toEqual({
			year: 2004,
			label: "January to December 2004",
		});
		expect(annualPeriod("Apr 2004 to Mar 2005 ")).toBeNull();
	});

	it("reads rates and levels with their intervals, keeping unavailable figures as null", async () => {
		const [part] = await unemploymentStatisticsPart(read);
		const values = (code: string, measure: string) =>
			Object.fromEntries(
				part.records
					.find((record) => record.code === code)!
					.values.filter((value) => value.measure === measure)
					.map((value) => [value.period?.label, value.value]),
			);

		// Fife is keyed by its current code.
		expect(part.records.some((record) => record.code === "S12000015")).toBe(
			false,
		);
		expect(values("S12000047", "unemployment-rate")).toEqual({
			"2003-04": 6.6,
			"2004": 6,
		});
		expect(values("S12000047", "unemployment-rate-interval")).toEqual({
			"2003-04": 1.2,
			"2004": 1.1,
		});
		expect(values("S12000047", "unemployed-people")).toEqual({
			"2003-04": 11000,
			"2004": 10000,
		});
		expect(values("S12000047", "unemployed-people-interval")).toEqual({
			"2003-04": 2000,
			"2004": 1900,
		});
		expect(values("E06000060", "unemployment-rate")).toEqual({
			"2003-04": null,
			"2004": 3.6,
		});
		expect(values("E06000060", "unemployment-rate-interval")).toEqual({
			"2003-04": null,
			"2004": null,
		});
	});

	it("gives a merged authority its predecessors' figures and no intervals", async () => {
		const [part] = await unemploymentStatisticsPart(read);
		const cumberland = part.records.find(
			(record) => record.code === "E06000063",
		)!;

		expect(Object.values(cumberland.parents ?? {})).toHaveLength(3);
		expect(
			cumberland.values.some((value) =>
				value.measure.endsWith("-interval"),
			),
		).toBe(false);
	});
});
