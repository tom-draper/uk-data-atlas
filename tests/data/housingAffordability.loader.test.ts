import { describe, expect, it } from "vitest";
import { loadHousingAffordability } from "@/lib/data/new-datasets/loader";

// Table 5c as the xlsx reader renders it: a title row, the header row, one
// row per district with "[x]" where ONS suppresses the ratio, then a blank.
const sheet = `Table 5c - Ratio of median house price (existing dwellings) to median gross annual residence-based earnings by local authority district
Country/Region code,Country/Region name,Local authority code,Local authority name,2024,2025,5-Year Average
E12000001,North East,E06000001,Hartlepool,4.05,4.55,4.28
E12000007,London,E09000001,City of London,[x],[x],[x]
E12000007,London,E09000020,Kensington and Chelsea,23.82,21.49,25.75
W92000004,Wales,W06000024,Merthyr Tydfil,4.52,4.4,4.5
,,,,,,
`;

const requests: [string, string][] = [];
const read = async (path: string, name: string) => {
	requests.push([path, name]);
	return sheet;
};

describe("loadHousingAffordability", () => {
	it("reads the 2025 median ratio for each district from table 5c", async () => {
		const datasets = await loadHousingAffordability(read);

		expect(requests.at(-1)?.[1]).toBe("5c");
		expect(datasets[2025].data.E06000001).toEqual({
			code: "E06000001",
			name: "Hartlepool",
			value: 4.55,
		});
		expect(datasets[2025].data.W06000024.value).toBe(4.4);
	});

	it("leaves out districts whose ratio ONS suppresses", async () => {
		const datasets = await loadHousingAffordability(read);

		expect(Object.keys(datasets[2025].data)).toEqual([
			"E06000001",
			"E09000020",
			"W06000024",
		]);
	});

	it("emits one local authority dataset for 2025", async () => {
		const datasets = await loadHousingAffordability(read);

		expect(Object.keys(datasets)).toEqual(["2025"]);
		expect(datasets[2025]).toMatchObject({
			id: "housingAffordability2025",
			type: "housingAffordability",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
		});
	});

	it("fails loudly if the 2025 column is missing", async () => {
		await expect(
			loadHousingAffordability(async () =>
				sheet.replace(",2025,", ",2026,"),
			),
		).rejects.toThrow(/no 2025 local authority column/);
	});
});
