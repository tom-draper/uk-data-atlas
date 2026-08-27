import { childPovertyDefinition } from "./childPoverty";
import { fuelPovertyDefinition } from "./fuelPoverty";
import { homelessnessDefinition } from "./homelessness";
import type { ScalarDatasetDefinition } from "./types";

export const SCALAR_DATASET_DEFINITIONS: readonly ScalarDatasetDefinition[] = [
	childPovertyDefinition,
	homelessnessDefinition,
	fuelPovertyDefinition,
] as const;

export type { ScalarDatasetDefinition } from "./types";
