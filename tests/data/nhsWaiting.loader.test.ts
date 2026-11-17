import { expect, it } from "vitest";
import { sourceDir, type DatasetReader } from "@uk-data-atlas/datasets";
import { nhsWaiting } from "../../packages/datasets/src/health/nhs-services/nhs-waiting/dataset.ts";

it("aggregates waiting bands from the archive", async () => {
	const [part] = await nhsWaiting.statistics.direct!.read({
		zipCsvRows: async (path, visit) => {
			expect(path).toBe(sourceDir("nhs-waiting", "rtt-mar-2026.zip"));
			for (const [total, first, second, kind] of [
				["100", "4", "3", "Incomplete Pathways"],
				["50", "2", "1", "Incomplete Pathways"],
				["999", "999", "999", "Admitted Pathways"],
			])
				visit({
					"RTT Part Description": kind,
					"Provider Parent Org Code": "E54000001",
					"Provider Parent Name": "NHS Somerset ICB",
					"Total All": total,
					"Gt 18 To 52 Weeks SUM 1": first,
					"Gt 52 Weeks SUM 1": second,
				});
		},
	} as DatasetReader);
	expect(part.records).toEqual([
		{
			code: "E54000001",
			name: "NHS Somerset ICB",
			values: [
				{ measure: "rtt-incomplete-pathways", value: 150 },
				{ measure: "rtt-incomplete-pathways-over-18-weeks", value: 10 },
			],
		},
	]);
	expect(part.relationships?.ladToIcb.E06000001).toBe("QHM");
});
