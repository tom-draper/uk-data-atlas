import type { ActiveViz, Dataset, Datasets } from "@lib/types";
import type { CustomDataset } from "@lib/types/custom";

export function getActiveDataset(
	datasets: Datasets,
	activeViz: ActiveViz,
	customDatasets: CustomDataset[],
): Dataset | null {
	if (activeViz.datasetType === "custom") {
		return customDatasets.find((d) => d.id === activeViz.vizId) ?? null;
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
