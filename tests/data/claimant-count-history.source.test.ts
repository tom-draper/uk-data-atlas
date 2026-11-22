import { describe, expect, it } from "vitest";
import { claimantCountHistoryStatisticsParts } from "@uk-data-atlas/datasets";

// The shape Nomis returns for NM_162_1: a count and a proportion on each row,
// and an empty proportion where the publisher suppresses it.
const csv = `"DATE_NAME","DATE","GEOGRAPHY_NAME","GEOGRAPHY_CODE","MEASURE_NAME","OBS_VALUE","OBS_STATUS_NAME"
"February 2013","2013-02","Hartlepool","E06000001","Claimant count",4800,"Normal Value"
"January 2013","2013-01","Hartlepool","E06000001","Claimant count",4840,"Normal Value"
"January 2013","2013-01","Hartlepool","E06000001","Claimants as a proportion of residents aged 16-64",8.3,"Normal Value"
"January 2013","2013-01","Isles of Scilly","E06000053","Claimant count",5,"Normal Value"
"January 2013","2013-01","Isles of Scilly","E06000053","Claimants as a proportion of residents aged 16-64",,"These figures are suppressed as value is 1 or 2"
`;

const read = async () => csv;

describe("claimantCountHistoryStatisticsParts", () => {
	it("makes a part for each month, in order", async () => {
		const parts = await claimantCountHistoryStatisticsParts(read);

		expect(parts.map((part) => part.key)).toEqual(["2013-01", "2013-02"]);
	});

	it("reads the count and the proportion of each authority", async () => {
		const [january] = await claimantCountHistoryStatisticsParts(read);

		expect(january.records[0]).toEqual({
			code: "E06000001",
			name: "Hartlepool",
			values: [
				{
					measure: "claimants",
					members: { "age-group": "totalCount" },
					value: 4840,
				},
				{ measure: "claimant-rate", value: 8.3 },
			],
		});
	});

	it("leaves out a suppressed proportion rather than reading it as none", async () => {
		const [january] = await claimantCountHistoryStatisticsParts(read);
		const scilly = january.records.find(
			(record) => record.code === "E06000053",
		);

		expect(scilly?.values.map((value) => value.measure)).toEqual([
			"claimants",
		]);
	});
});
