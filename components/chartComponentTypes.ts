import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";

/** Props supplied by the registry-driven chart card renderer. */
export interface ChartComponentProps {
	activeDataset: Dataset | null;
	availableDatasets: Datasets[keyof Datasets];
	aggregatedData: Record<string, unknown> | null;
	year: number;
	datasetId?: string;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	boundaryData: BoundaryData;
}
