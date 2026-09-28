import { describe, expect, it } from "vitest";
import { APRIL_2023_LAD_MERGERS } from "@/lib/data/localAuthority/reorganisations";
import { annualPeriod, loadUnemployment } from "@/lib/data/unemployment/loader";

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
		const [dataset] = Object.values(await loadUnemployment(read));

		expect(dataset.years).toEqual([2003, 2004]);
		expect(dataset.periodLabels).toEqual({
			2003: "April 2003 to March 2004",
			2004: "January to December 2004",
		});
		// Fife is keyed by its current code.
		expect(dataset.data.S12000047).toMatchObject({
			rates: { 2003: 6.6, 2004: 6 },
			rateIntervals: { 2003: 1.2, 2004: 1.1 },
			levels: { 2003: 11000, 2004: 10000 },
			levelIntervals: { 2003: 2000, 2004: 1900 },
		});
		expect(dataset.data.E06000060).toMatchObject({
			rates: { 2003: null, 2004: 3.6 },
			rateIntervals: { 2003: null, 2004: null },
		});
	});
});
