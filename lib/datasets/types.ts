import type { Dataset } from "@/lib/types/datasets";

export type ScalarMapOptionsKey =
	| "childPoverty"
	| "homelessness"
	| "fuelPoverty";

/**
 * The common map contract for scalar datasets. Keep this deliberately small:
 * datasets with category, point, or derived-value rendering use their own
 * dedicated paths.
 */
export interface ScalarMapDefinition {
	codeLevel: "localAuthority" | "lsoa";
	valueKey: string;
	mapOptionsKey: ScalarMapOptionsKey;
}

export interface ScalarDatasetDefinition<T extends Dataset = Dataset> {
	type: T["type"];
	precompiledFile: string;
	sourcePath: string;
	chart: {
		group: string;
		key: string;
		label: string;
		defaultVisible: boolean;
	};
	load: (content: string) => Record<string, T>;
	map: ScalarMapDefinition;
}
