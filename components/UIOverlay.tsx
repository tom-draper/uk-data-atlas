import { useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import ControlPanel from "@components/ControlPanel";
import LegendPanel from "@components/LegendPanel";
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
		<div
			className="pointer-events-auto flex h-full w-[320px] flex-col p-2.5"
			role="status"
			aria-label="Loading data panel"
		>
			<div className="h-full min-h-80 animate-pulse rounded-md bg-black/10" />
		</div>
	);
}

const ChartPanel = dynamic(() => import("@components/ChartPanel"), {
	ssr: false,
	loading: ChartPanelLoading,
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

	const controlPanel = (onLocationSelected: (location: string) => void) => (
		<ControlPanel
			populationDataset={datasets.population[2022]}
			selectedLocation={selectedLocation}
			onLocationClick={onLocationSelected}
			onZoomIn={onZoomIn}
			onZoomOut={onZoomOut}
			handleMapOptionsChange={onMapOptionsChange}
			onExport={onExport}
		/>
	);

	const chartPanel = (
		<ExcludedCategoriesContext.Provider value={excludedCategories}>
			<ChartPanel
				datasets={datasets}
				customDatasets={customDatasets}
				addCustomDataset={addCustomDataset}
				roadSafetyDatasets={roadSafetyDatasets}
				networkDatasets={networkDatasets}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
				activeDataset={activeDataset}
				chartsLoading={chartsLoading}
				selectedArea={selectedArea}
				boundaryData={boundaryData}
				codeMapper={codeMapper}
				mapManager={mapManager}
				location={selectedLocation}
			/>
		</ExcludedCategoriesContext.Provider>
	);

	return (
		<PanelContext.Provider value={panelContextValue}>
			<div className="fixed inset-0 z-50 size-full pointer-events-none">
				{isDesktopLayout ? (
					<>
						<div className="absolute left-0 flex h-full">
							{controlPanel(onLocationClick)}
						</div>
						<div className="absolute right-0 flex h-full">
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
							{chartPanel}
						</div>
					</>
				) : (
					<MobilePanels
						isDark={mapOptions.baseStyle.id === "darkMatter"}
						renderControlPanel={(closePanel) =>
							controlPanel((location) => {
								onLocationClick(location);
								closePanel();
							})
						}
						chartPanel={chartPanel}
					/>
				)}
			</div>
		</PanelContext.Provider>
	);
}
