import type { Dataset } from "@/lib/types/datasets";

export interface ScalarDatasetDefinition<T extends Dataset = Dataset> {
	type: T["type"];
	precompiledFile: string;
	sourcePath: string;
	sourceFormat: "ods" | "text";
	chart: {
		group: string;
		key: string;
		label: string;
		defaultVisible: boolean;
	};
	load: (content: string) => Record<string, T> | Promise<Record<string, T>>;
}
