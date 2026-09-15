import { describe, expect, it } from "vitest";
import { loadRoadCollisionsByAuthority } from "@/lib/data/road-safety/authorityLoader";

const csv = (rows: Array<[string, string, string]>) =>
	[
		"collision_index,date,collision_severity,local_authority_ons_district",
		...rows.map(([date, severity, code], index) =>
			[index, date, severity, code].join(","),
		),
	].join("\n");

describe("road collisions by local authority", () => {
	it("counts collisions by the authority DfT assigns and by severity", async () => {
		const datasets = await loadRoadCollisionsByAuthority(async () =>
			csv([
				["01/01/2025", "1", "E09000007"],
				["15/02/2025", "3", "E09000007"],
				["30/03/2025", "2", "S12000035"],
				["10/03/2025", "3", "EHEATHROW"],
				["11/02/2025", "3", "EHEATHROW"],
			]),
		);

		expect(Object.keys(datasets)).toEqual(["2025"]);
		const dataset = datasets[2025];
		expect(dataset.period).toBe("January to March 2025");
		expect(dataset.boundaryYear).toBe(2024);
		expect(dataset.data).toEqual({
			E09000007: {
				ladCode: "E09000007",
				collisions: 2,
				fatal: 1,
				serious: 0,
				slight: 1,
			},
			S12000035: {
				ladCode: "S12000035",
				collisions: 1,
				fatal: 0,
				serious: 1,
				slight: 0,
			},
		});
		expect(dataset.excluded).toEqual([
			{ code: "EHEATHROW", collisions: 2 },
		]);
	});

	it("refuses months that are not consecutive and unrecognised severities", async () => {
		await expect(
			loadRoadCollisionsByAuthority(async () =>
				csv([
					["01/01/2025", "1", "E09000007"],
					["01/03/2025", "1", "E09000007"],
				]),
			),
		).rejects.toThrow(/not consecutive/);
		await expect(
			loadRoadCollisionsByAuthority(async () =>
				csv([["01/01/2025", "4", "E09000007"]]),
			),
		).rejects.toThrow(/no recognised severity/);
	});
});
