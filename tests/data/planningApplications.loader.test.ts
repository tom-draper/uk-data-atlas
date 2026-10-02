import { describe, expect, it } from "vitest";
import { loadPlanningApplications } from "@/lib/data/new-datasets/loader";

describe("loadPlanningApplications", () => {
	it("aggregates application rows as they are read from the CSV", async () => {
		const result = await loadPlanningApplications(
			async (path, options, visit) => {
				expect(path).toBe(
					"housing/planning-applications/ps1-full-2026-03.csv",
				);
				expect(options).toEqual({ skipLines: 3 });
				visit({
					Quarter: "2026 Q1",
					LPACD: "E06000001",
					LPANM: "Hartlepool",
					"Applications received": "100",
				});
			},
		);

		expect(result[2026]?.data.E06000001).toEqual({
			code: "E06000001",
			name: "Hartlepool",
			value: 100,
		});
	});
});
