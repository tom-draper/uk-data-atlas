import { loadChildPoverty } from "@/lib/data/child-poverty/loader";
import type { ChildPovertyDataset } from "@/lib/types/childPoverty";
import type { ScalarDatasetDefinition } from "./types";

export const childPovertyDefinition: ScalarDatasetDefinition<ChildPovertyDataset> = {
	type: "childPoverty",
	precompiledFile: "child-poverty",
	sourcePath: "economics/child-poverty/children-in-low-income-families-2022-2025.ods",
	chart: {
		group: "Economics",
		key: "economics-childPoverty",
		label: "Child Poverty [2025]",
		defaultVisible: true,
	},
	load: loadChildPoverty,
	map: {
		codeLevel: "localAuthority",
		valueKey: "childPovertyRate",
		mapOptionsKey: "childPoverty",
	},
};
