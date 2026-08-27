import { describe, expect, it } from "vitest";
import { loadHousingAffordability } from "@/lib/data/housing-affordability/loader";
import { SCALAR_DATASET_DEFINITIONS } from "@/lib/datasets";

describe("loadHousingAffordability", () => {
	it("registers the CSV source as a scalar dataset", () => {
		expect(SCALAR_DATASET_DEFINITIONS).toContainEqual(
			expect.objectContaining({
				type: "housingAffordability",
				precompiledFile: "housing-affordability",
				sourceFormat: "text",
			}),
		);
	});

	it("loads the ONS local-authority affordability ratio", async () => {
		const datasets = await loadHousingAffordability(
			[
				"areacd,areanm,period,value",
				"E06000001,Hartlepool,2025-04-01,4.86",
				"W06000001,Isle of Anglesey,2025-04-01,5.12",
				"E06000002,Middlesbrough,2025-04-01,",
			].join("\n"),
		);

		expect(datasets[2025]).toMatchObject({
			id: "housingAffordability2025",
			type: "housingAffordability",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
		});
		expect(datasets[2025].data).toEqual({
			E06000001: {
				ladCode: "E06000001",
				ladName: "Hartlepool",
				ratio: 4.86,
			},
			W06000001: {
				ladCode: "W06000001",
				ladName: "Isle of Anglesey",
				ratio: 5.12,
			},
		});
	});
});
