import { expect, it } from "vitest";
import {
	planningApplications,
	sourceDir,
	type DatasetReader,
} from "@uk-data-atlas/datasets";

it("reads planning counts and omits suppressed values", async () => {
	const [part] = await planningApplications.statistics.direct!.read({
		csvRows: async (path, options, visit) => {
			expect(path).toBe(
				sourceDir("planning-applications", "ps1-full-2026-03.csv"),
			);
			expect(options).toEqual({ skipLines: 3 });
			visit({
				Quarter: "2026 Q1",
				LPACD: "E06000001",
				LPANM: "Hartlepool",
				"Applications received": "100",
				"Applications decided": "80",
				"Applications withdrawn": "..",
			});
		},
	} as DatasetReader);
	expect(part).toEqual({
		key: "2026",
		records: [
			{
				code: "E06000001",
				name: "Hartlepool",
				values: [
					{
						measure: "planning-applications",
						members: { "application-stage": "received" },
						value: 100,
					},
					{
						measure: "planning-applications",
						members: { "application-stage": "decided" },
						value: 80,
					},
				],
			},
		],
	});
});
