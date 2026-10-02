import { useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import ControlPanel from "@components/ControlPanel";
import LegendPanel from "@components/LegendPanel";
import LocationPanel from "@components/LocationPanel";
import MapOptionsPane from "@components/MapOptions";
import { ChartPanelShell } from "@components/ChartPanelShell";
import type {
	ActiveViz,
	BoundaryData,
	Dataset,
	Datasets,
	SelectedArea,
} from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { PanelContext } from "@/lib/context/PanelContext";
import { ExcludedCategoriesContext } from "@/lib/context/ExcludedCategoriesContext";
import { MobilePanels } from "./ui-overlay/MobilePanels";
import { excludedCategoriesForMapOptions } from "./ui-overlay/excludedCategories";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

function ChartPanelLoading() {
	return (
		<ChartPanelShell>
			{() => (
				<div
					className="space-y-2.5 flex-1 px-2.5 overflow-hidden"
					role="status"
					aria-label="Loading data panel"
				>
					<div className="chart-shimmer h-16" />
					<div className="chart-shimmer h-16" />
					<div className="chart-shimmer h-16" />
				</div>
			)}
		</ChartPanelShell>
	);
}

const ChartPanel = dynamic(() => import("@components/ChartPanel"), {
	ssr: false,
	loading: ChartPanelLoading,
});

// Loaded apart from the chart panel, so each layout fetches only the charts
// it shows.
const ActiveChartCard = dynamic(() => import("./ui-overlay/ActiveChartCard"), {
	ssr: false,
});

function subscribeToDesktopLayout(onStoreChange: () => void) {
	const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);
	return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopLayoutSnapshot() {
	return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function useIsDesktopLayout() {
	return useSyncExternalStore(
		subscribeToDesktopLayout,
		getDesktopLayoutSnapshot,
		() => false,
	);
}

interface UIOverlayProps {
	datasets: Datasets;
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	activeDataset: Dataset | null;
	chartsLoading: boolean;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	selectedArea: SelectedArea | null;
	boundaryData: BoundaryData;
	mapOptions: MapOptions;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	onMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
	onLocationClick: (location: string) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onExport: () => void;
}

export default function UIOverlay({
	datasets,
	customDatasets,
	addCustomDataset,
	roadSafetyDatasets,
	networkDatasets,
	activeDataset,
	activeViz,
	setActiveViz,
	chartsLoading,
	selectedLocation,
	selectedArea,
	boundaryData,
	mapOptions,
	codeMapper,
	mapManager,
	onMapOptionsChange,
	onLocationClick,
	onZoomIn,
	onZoomOut,
	onExport,
}: UIOverlayProps) {
	const isDesktopLayout = useIsDesktopLayout();
	const panelContextValue = { selectedArea, selectedLocation };
	const excludedCategories = useMemo(
		() => excludedCategoriesForMapOptions(mapOptions),
		[
			mapOptions.generalElection.excluded,
			mapOptions.generalElection.mode,
			mapOptions.generalElection.selected,
			mapOptions.localElection.excluded,
			mapOptions.localElection.mode,
			mapOptions.localElection.selected,
			mapOptions.ethnicity.excluded,
			mapOptions.ethnicity.mode,
			mapOptions.ethnicity.selected,
			mapOptions.custom.excludedPointValues,
			mapOptions.custom.selectedPointValue,
		],
	);

	const chartProps = {
		datasets,
		customDatasets,
		addCustomDataset,
		roadSafetyDatasets,
		networkDatasets,
		activeViz,
		setActiveViz,
		activeDataset,
		chartsLoading,
		selectedArea,
		boundaryData,
		codeMapper,
		mapManager,
		location: selectedLocation,
	};

	const legendPanel = (
		<LegendPanel
			activeDataset={activeDataset}
			activeViz={activeViz}
			mapOptions={mapOptions}
			onMapOptionsChange={onMapOptionsChange}
			mapManager={mapManager}
			boundaryData={boundaryData}
			location={selectedLocation}
			datasets={datasets}
		/>
	);

	return (
		<PanelContext.Provider value={panelContextValue}>
			<ExcludedCategoriesContext.Provider value={excludedCategories}>
				<div className="fixed inset-0 z-50 size-full pointer-events-none">
					{isDesktopLayout ? (
						<>
							<div className="absolute left-0 flex h-full">
								<ControlPanel
									populationDataset={
										datasets.population[2022]
									}
									selectedLocation={selectedLocation}
									onLocationClick={onLocationClick}
									onZoomIn={onZoomIn}
									onZoomOut={onZoomOut}
									handleMapOptionsChange={onMapOptionsChange}
									onExport={onExport}
								/>
							</div>
							<div className="absolute right-0 flex h-full">
								{legendPanel}
								<ChartPanel {...chartProps} />
							</div>
						</>
					) : (
						<MobilePanels
							isDark={mapOptions.baseStyle.id === "darkMatter"}
							activeChartCard={
								<ActiveChartCard {...chartProps} />
							}
							renderChartPanel={(closePanel) => (
								<ChartPanel
									{...chartProps}
									setActiveViz={(viz) => {
										setActiveViz(viz);
										closePanel();
									}}
									cardsOnly
								/>
							)}
							renderLocationPanel={(closePanel) => (
								<LocationPanel
									populationDataset={
										datasets.population[2022]
									}
									selectedLocation={selectedLocation}
									onLocationClick={(location) => {
										onLocationClick(location);
										closePanel();
									}}
								/>
							)}
							mapOptions={
								<MapOptionsPane
									onZoomIn={onZoomIn}
									onZoomOut={onZoomOut}
									handleMapOptionsChange={onMapOptionsChange}
									onExport={onExport}
								/>
							}
							legend={legendPanel}
						/>
					)}
				</div>
			</ExcludedCategoriesContext.Provider>
		</PanelContext.Provider>
	);
}
