import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import type { ValueCardConfig } from "@/lib/datasets/valueCard";
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
	/** The declarative card, for charts rendered by the shared value card. */
	card?: ValueCardConfig;
}
