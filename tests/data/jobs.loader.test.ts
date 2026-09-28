import { describe, expect, it } from "vitest";
import { loadJobs } from "@/lib/data/jobs/loader";

// The shape NOMIS returns: quoted headers and names, an empty value with
// status Q where a figure is not published.
const csv = `"DATE_NAME","GEOGRAPHY_CODE","GEOGRAPHY_NAME","OBS_VALUE","OBS_STATUS","OBS_STATUS_NAME"
"2019","E08000003","Manchester",460000,"A","Normal Value"
"2019","N09000001","Antrim and Newtownabbey",,"Q","These figures are missing."
"2020","E08000003","Manchester",455000,"A","Normal Value"
"2020","N09000001","Antrim and Newtownabbey",68000,"A","Normal Value"
`;

const read = async () => csv;

describe("loadJobs", () => {
	it("reads total jobs for each district and year", async () => {
		const datasets = await loadJobs(read);

		expect(datasets[2019].data.E08000003).toEqual({
			ladCode: "E08000003",
			ladName: "Manchester",
			totalJobs: 460000,
		});
		expect(datasets[2020].data.N09000001.totalJobs).toBe(68000);
	});

	it("leaves out a figure that is not published rather than reading it as none", async () => {
		const datasets = await loadJobs(read);

		expect(Object.keys(datasets[2019].data)).toEqual(["E08000003"]);
		expect(datasets[2019].data.N09000001).toBeUndefined();
	});

	it("emits one dataset per year on the April 2023 codes", async () => {
		const datasets = await loadJobs(read);

		expect(Object.keys(datasets)).toEqual(["2019", "2020"]);
		expect(datasets[2020]).toMatchObject({
			id: "jobs2020",
			type: "jobs",
			boundaryType: "localAuthority",
			boundaryYear: 2023,
		});
	});
});
