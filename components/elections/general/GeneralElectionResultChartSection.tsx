// components/GeneralElectionResultChart.tsx
"use client";

import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import type { BoundaryData } from "@lib/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import ChartCards, { hasVisibleChart } from "@/components/ChartCards";

interface GeneralElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function GeneralElectionResultChartSection(props: GeneralElectionResultChartSectionProps) {
	const { visibility } = useChartVisibility();
	if (!hasVisibleChart("General Election", visibility)) return null;

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold pt-2">General Election Results</h3>
			<ChartCards group="General Election" visibility={visibility} {...props} />
		</div>
	);
}
