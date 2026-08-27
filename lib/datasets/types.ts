import type { Dataset } from "@/lib/types/datasets";

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
}
