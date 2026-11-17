import type { MapOptions } from "@/lib/types/mapOptions";
import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import type { BarsCardConfig } from "@/lib/measures/barsConfig";
import type { BreakdownCardConfig } from "@/lib/measures/breakdownConfig";
import type { SeriesCardConfig } from "@/lib/measures/seriesConfig";
import type { DeprivationCardConfig } from "@/lib/datasets/deprivationCard";
import type { ValueCardConfig } from "@/lib/datasets/valueCard";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@uk-data-atlas/datasets";

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
	cardForOptions?(options: MapOptions): ValueCardConfig;
	/** The declarative history card, for charts drawn by the shared series chart. */
	seriesForOptions?(options: MapOptions): SeriesCardConfig;
	/** The declarative breakdown card, for charts drawn by the shared breakdown chart. */
	breakdown?: BreakdownCardConfig;
	/** The declarative bars card, for charts drawn by the shared bars chart. */
	bars?: BarsCardConfig;
	/** The declarative deprivation card, for charts drawn by the shared deprivation chart. */
	deprivation?: DeprivationCardConfig;
}
