// components/ChartPanel.tsx
"use client";
import {
	Dataset,
	Datasets,
	ActiveViz,
	SelectedArea,
	BoundaryData,
} from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import { NetworkDataset } from "@/lib/types/network";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useDeferredValue } from "react";
import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import TransportSection from "./transport/TransportSection";
import CustomSection from "./custom/CustomSection";
import ChartSections from "./ChartSections";
import { ChartLoadingProvider } from "./ChartLoadingPlaceholder";
import { ChartVisibilityProvider } from "@/lib/context/ChartVisibilityContext";
import ChartSettings from "./ChartSettings";
import { ChartPanelShell } from "./ChartPanelShell";

interface ChartPanelProps {
	selectedArea: SelectedArea | null;
	activeDataset: Dataset | null;
	boundaryData: BoundaryData;
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
	const deferredArea = useDeferredValue(selectedArea);

	return (
		<ChartPanelShell>
			{(settingsOpen) =>
				settingsOpen ? (
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
								boundaryData={boundaryData}
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
								mapManager={mapManager}
								boundaryData={boundaryData}
								location={location}
							/>
						</ChartLoadingProvider>
					</div>
				)
			}
		</ChartPanelShell>
	);
}

export default function ChartPanel(props: ChartPanelProps) {
	return (
		<ChartVisibilityProvider>
			<ChartPanelContent {...props} />
		</ChartVisibilityProvider>
	);
}
