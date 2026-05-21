// components/population/density/PopulationDensity.tsx
import { memo } from "react";
import {
	ActiveViz,
	AggregatedPopulationData,
	BoundaryData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import PopulationDensityChart from "./PopulationDensityChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface PopulationDensityProps {
	dataset: PopulationDataset;
	boundaryData: BoundaryData;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function PopulationDensity(props: PopulationDensityProps) {
	return <PopulationDensityChart {...props} />;
}

export default memo(PopulationDensity);
