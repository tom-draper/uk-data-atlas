import type { ActiveViz, Dataset, Datasets } from "@lib/types";
import type { CustomDataset } from "@lib/types/custom";

export function getActiveDataset(
	datasets: Datasets,
	activeViz: ActiveViz,
	customDataset: CustomDataset | null,
): Dataset | null {
	if (activeViz.datasetType === "custom") {
		return customDataset;
	}

	const datasetGroup = datasets[activeViz.datasetType] as
		| Record<string, Dataset>
		| undefined;

	return (
		datasetGroup?.[activeViz.vizId] ??
		datasetGroup?.[String(activeViz.datasetYear)] ??
		null
	);
}
