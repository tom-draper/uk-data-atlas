import assert from "node:assert/strict";
import { test } from "vitest";
import type { DataCatalog, Measure } from "@uk-data-atlas/measures";
import { resolveObservations } from "../src/observationResolution/observationPlan";

test("plans the selected series without looking it up by catalogue id", () => {
	const source = {
		datasetId: "census",
		sourceGeography: { type: "ward", boundaryYear: 2021 },
		periods: ["2021"],
	};
	const measure = {
		id: "legacy-id",
		sources: [source],
	} as unknown as Measure;
	const dataCatalog = { measures: [] } as unknown as DataCatalog;
	const result = resolveObservations(
		{ dataCatalog },
		{
			measureId: "households",
			measure,
			periods: ["2021"],
			geography: "ward",
			boundaryYear: "2021",
		},
	);
	assert.equal(result.kind, "plan");
	if (result.kind === "plan") {
		assert.equal(result.plan.measure, measure);
		assert.equal(result.plan.source, source);
	}
});
