import { correctionsForMeasure } from "../index.ts";

export const correctionsReport = (measureId: string | null) => ({
	records: correctionsForMeasure(measureId),
	filters: { measure: measureId },
	note: "These records describe API-owned changes to served values or semantics. They do not rewrite the publisher artifacts, which remain the source evidence.",
});
