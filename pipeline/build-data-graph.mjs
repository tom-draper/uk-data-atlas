import { apiStages } from "./build-data-api-stages.mjs";
import { websiteStages } from "./build-data-website-stages.mjs";
import { assertStageOwnership } from "./build-data-ownership.mjs";

// A graph in which two stages declare one path does not load.
export const buildDataStages = assertStageOwnership([
	...apiStages,
	...websiteStages,
]);
