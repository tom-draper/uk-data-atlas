import { correctionsForMeasure } from "@uk-data-atlas/catalogue";

export const correctionsReport = (measureId: string | null) => ({
	records: correctionsForMeasure(measureId),
	filters: { measure: measureId },
	note: "These records describe API-owned changes to served values or semantics. They do not rewrite the publisher artifacts, which remain the source evidence.",
});
