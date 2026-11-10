import { apiStages } from "./build-data-api-stages.mjs";
import { websiteStages } from "./build-data-website-stages.mjs";

export const buildDataStages = [...apiStages, ...websiteStages];
