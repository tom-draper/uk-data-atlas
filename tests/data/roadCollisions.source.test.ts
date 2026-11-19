import { describe, expect, it } from "vitest";
import { roadCollisionsStatisticsParts } from "@uk-data-atlas/datasets";
import type { DatasetReader } from "@uk-data-atlas/datasets";

const COLUMNS = [
	"collision_index",
	"date",
	"collision_severity",
	"local_authority_ons_district",
	"lsoa_of_accident_location",
];

/** A reader over the same rows for each annual file, the year following the file name. */
const reader =
	(
		rows: Array<[string, string, string, string?]>,
	): DatasetReader["csvRows"] =>
	async (path, _options, visit) => {
		const year = path.includes("2024") ? "2024" : "2025";
		rows.forEach(([date, severity, code, lsoa = "-1"], index) =>
			visit(
				Object.fromEntries(
					COLUMNS.map((column, position) => [
						column,
						[
							String(index),
							date.replace("2025", year),
							severity,
							code,
							lsoa,
						][position]!,
					]),
				),
			),
		);
	};

const valuesOf = (records: { code: string; values: unknown[] }[]) =>
	Object.fromEntries(
		records.map(({ code, values }) => [
			code,
			Object.fromEntries(
				(
					values as {
						members: Record<string, string>;
						value: number;
					}[]
				).map(({ members, value }) => [
					members["collision-severity"],
					value,
				]),
			),
		]),
	);

describe("road collisions by local authority", () => {
	it("counts collisions by the authority DfT assigns and by severity", async () => {
		const parts = await roadCollisionsStatisticsParts(
			reader([
				["01/01/2025", "1", "E09000007", "E01000886"],
				["15/02/2025", "3", "E09000007", "E01000886"],
				["30/03/2025", "2", "S12000035"],
				["10/03/2025", "3", "EHEATHROW", "E01002444"],
				["11/02/2025", "3", "EHEATHROW", "E01002443"],
				["12/02/2025", "3", "E06000042"],
			]),
		);

		expect(parts.map(({ key }) => key)).toEqual(["2024", "2025"]);
		const part = parts[1]!;
		expect(valuesOf(part.records)).toEqual({
			E06000042: { collisions: 1, fatal: 0, serious: 0, slight: 1 },
			E09000007: { collisions: 2, fatal: 1, serious: 0, slight: 1 },
			S12000035: { collisions: 1, fatal: 0, serious: 1, slight: 0 },
		});
		// Heathrow's collisions have LSOAs even though they have no authority.
		expect(valuesOf(part.recordSets!.lsoas!)).toEqual({
			E01000886: { collisions: 2, fatal: 1, serious: 0, slight: 1 },
			E01002443: { collisions: 1, fatal: 0, serious: 0, slight: 1 },
			E01002444: { collisions: 1, fatal: 0, serious: 0, slight: 1 },
		});
		// What has no authority or no LSOA is kept as the part's gaps.
		expect(part.gaps).toEqual([
			{ kind: "collision-area", code: "EHEATHROW", collisions: 2 },
			{ kind: "collision-without-lsoa", country: "GB-SCT", collisions: 1 },
			{ kind: "collision-without-lsoa", country: "GB-ENG", collisions: 1 },
		]);
	});

	it("refuses months that are not consecutive and unrecognised severities", async () => {
		await expect(
			roadCollisionsStatisticsParts(
				reader([
					["01/01/2025", "1", "E09000007"],
					["01/03/2025", "1", "E09000007"],
				]),
			),
		).rejects.toThrow(/not consecutive/);
		await expect(
			roadCollisionsStatisticsParts(
				reader([["01/01/2025", "4", "E09000007"]]),
			),
		).rejects.toThrow(/no recognised severity/);
	});
});
