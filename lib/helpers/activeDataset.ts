import type { ActiveViz, Dataset, Datasets } from "@lib/types";
import type { CustomDataset } from "@lib/types/custom";
import type { NetworkDataset } from "@lib/types/network";

export function getActiveDataset(
	datasets: Datasets,
	activeViz: ActiveViz,
	customDatasets: (CustomDataset | NetworkDataset)[],
): Dataset | null {
	if (
		activeViz.datasetType === "custom" ||
		activeViz.datasetType === "network"
	) {
		return customDatasets.find((d) => d.id === activeViz.datasetId) ?? null;
	}

	const datasetGroup = datasets[activeViz.datasetType] as
		Record<string, Dataset> | undefined;

	return (
		datasetGroup?.[activeViz.datasetId] ??
		datasetGroup?.[String(activeViz.datasetYear)] ??
		null
	);
}
