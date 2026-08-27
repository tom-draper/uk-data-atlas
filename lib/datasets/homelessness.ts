import { loadHomelessness } from "@/lib/data/homelessness/loader";
import type { HomelessnessDataset } from "@/lib/types/homelessness";
import type { ScalarDatasetDefinition } from "./types";

export const homelessnessDefinition: ScalarDatasetDefinition<HomelessnessDataset> = {
	type: "homelessness",
	precompiledFile: "homelessness",
	sourcePath: "economics/homelessness/homelessness-2026-q1.ods",
	chart: {
		group: "Economics",
		key: "economics-homelessness",
		label: "Homelessness [2026]",
		defaultVisible: true,
	},
	load: loadHomelessness,
};
