"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import ChartCards, { hasVisibleChart } from "@/components/ChartCards";

interface Props { activeDataset: Dataset | null; datasets: Datasets; selectedArea: SelectedArea | null; codeMapper?: CodeMapper; activeViz: ActiveViz; setActiveViz: (value: ActiveViz) => void; mapManager: MapManager | null; boundaryData: BoundaryData; location: string | null; }

export default function TelecomsSection(props: Props) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	if (!hasVisibleChart("Telecoms", visibility)) return null;
	return <div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}><h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>Telecoms</h3><ChartCards group="Telecoms" visibility={visibility} {...props} /></div>;
}
