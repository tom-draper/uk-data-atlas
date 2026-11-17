import { describe, expect, it } from "vitest";
import { jobsStatisticsParts } from "@uk-data-atlas/datasets";

// The shape NOMIS returns: quoted headers and names, an empty value with
// status Q where a figure is not published.
const csv = `"DATE_NAME","GEOGRAPHY_CODE","GEOGRAPHY_NAME","OBS_VALUE","OBS_STATUS","OBS_STATUS_NAME"
"2020","E08000003","Manchester",455000,"A","Normal Value"
"2019","E08000003","Manchester",460000,"A","Normal Value"
"2019","N09000001","Antrim and Newtownabbey",,"Q","These figures are missing."
"2020","N09000001","Antrim and Newtownabbey",68000,"A","Normal Value"
`;

const read = async () => csv;

describe("jobsStatisticsParts", () => {
	it("reads total jobs for each district and year", async () => {
		const parts = await jobsStatisticsParts(read);

		expect(parts.map((part) => part.key)).toEqual(["2019", "2020"]);
		expect(parts[0].records).toEqual([
			{
				code: "E08000003",
				name: "Manchester",
				values: [{ measure: "total-jobs", value: 460000 }],
			},
		]);
		expect(parts[1].records.map((record) => record.code)).toEqual([
			"E08000003",
			"N09000001",
		]);
	});

	it("leaves out a figure that is not published rather than reading it as none", async () => {
		const parts = await jobsStatisticsParts(read);

		expect(parts[0].records.map((record) => record.code)).toEqual([
			"E08000003",
		]);
	});
});
