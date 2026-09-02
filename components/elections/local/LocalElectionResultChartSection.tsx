// components/LocalElectionResultChart.tsx
"use client";

import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import type { BoundaryData } from "@lib/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import ChartCards, { hasVisibleChart } from "@/components/ChartCards";

interface LocalElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function LocalElectionResultChartSection(props: LocalElectionResultChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	if (!hasVisibleChart("Local Election", visibility)) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
			>
				Local Election Results
			</h3>
			<ChartCards group="Local Election" visibility={visibility} {...props} />
		</div>
	);
}
