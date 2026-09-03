// components/ChartPanel.tsx
"use client";
import {
	Dataset,
	Datasets,
	ActiveViz,
	SelectedArea,
	BoundaryData,
	BoundaryCodes,
} from "@lib/types";
import { BoundaryData as BoundaryDataBoundaries } from "@lib/types/boundaries";
import { CustomDataset } from "@/lib/types/custom";
import { NetworkDataset } from "@/lib/types/network";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useState, useDeferredValue } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import TransportSection from "./transport/TransportSection";
import CustomSection from "./custom/CustomSection";
import ChartSections from "./ChartSections";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import { ChartLoadingProvider } from "./ChartLoadingPlaceholder";
import { ChartVisibilityProvider } from "@/lib/context/ChartVisibilityContext";
import ChartSettings from "./ChartSettings";
import PanelHeader from "./PanelHeader";
import PanelFooter from "./PanelFooter";

interface ChartPanelProps {
	selectedArea: SelectedArea | null;
	activeDataset: Dataset | null;
	boundaryData: BoundaryData;
	boundaryCodes: BoundaryCodes;
	datasets: Datasets;
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	chartsLoading: boolean;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	location: string;
}

function ChartPanelContent({
	selectedArea,
	activeDataset,
	boundaryData,
	boundaryCodes,
	datasets,
	customDatasets,
	addCustomDataset,
	roadSafetyDatasets,
	networkDatasets,
	activeViz,
	setActiveViz,
	chartsLoading,
	codeMapper,
	mapManager,
	location,
}: ChartPanelProps) {
	const isDark = useIsDark();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const deferredArea = useDeferredValue(selectedArea);
	const toggleSettings = () => setSettingsOpen((o) => !o);

	// BoundaryData from @lib/types is the same shape as @lib/types/boundaries
	const bd = boundaryData as unknown as BoundaryDataBoundaries;

	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div
				className={`rounded-md h-full flex flex-col relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div
					className="relative flex flex-col h-full"
					style={{ zIndex: 1 }}
				>
					<PanelHeader
						settingsOpen={settingsOpen}
						onToggleSettings={toggleSettings}
					/>

					{settingsOpen ? (
						<ChartSettings />
					) : (
						<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container [&>*:first-child]:border-t-0">
							<ChartLoadingProvider loading={chartsLoading}>
								<ChartSections
									activeDataset={activeDataset}
									datasets={datasets}
									selectedArea={deferredArea}
									codeMapper={codeMapper}
									activeViz={activeViz}
									setActiveViz={setActiveViz}
									aggregator={
										mapManager?.datasetAggregator ?? null
									}
									boundaryData={bd}
									location={location}
								/>
								<TransportSection
									roadSafetyDatasets={roadSafetyDatasets}
									networkDatasets={networkDatasets}
									activeViz={activeViz}
									setActiveViz={setActiveViz}
									location={location}
									mapManager={mapManager}
								/>
								<CustomSection
									customDatasets={customDatasets}
									addCustomDataset={addCustomDataset}
									selectedArea={deferredArea}
									activeViz={activeViz}
									setActiveViz={setActiveViz}
									codeMapper={codeMapper}
									boundaryCodes={boundaryCodes}
									mapManager={mapManager}
									boundaryData={bd}
									location={location}
								/>
							</ChartLoadingProvider>
						</div>
					)}

					<PanelFooter />
				</div>
			</div>
		</div>
	);
}

export default function ChartPanel(props: ChartPanelProps) {
	return (
		<ChartVisibilityProvider>
			<ChartPanelContent {...props} />
		</ChartVisibilityProvider>
	);
}
