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

export interface DatasetSource {
	name: string;
	source: string;
	sourceUrl: string;
	year: string;
	licence: string;
	licenceUrl: string;
	description: string;
}

export interface ScalarDatasetMap {
	valueKey: string;
	colorRange: { min: number; max: number };
	legend: {
		min: number;
		max: number;
		format: (value: number) => string;
	};
}

export interface ScalarDatasetDefinition<T extends { type: string } = { type: string }> {
	type: T["type"];
	precompiledFile: string;
	sourcePath: string;
	chart: {
		group: string;
		key: string;
		label: string;
		defaultVisible: boolean;
	};
	source: DatasetSource;
	map: ScalarDatasetMap;
	load: (content: string) => Record<string, T>;
	map: ScalarMapDefinition;
}
