import { useState, useMemo } from "react";
import ControlPanel from "@components/ControlPanel";
import LegendPanel from "@components/LegendPanel";
import ChartPanel from "@components/ChartPanel";
import type {
	ActiveViz,
	BoundaryCodes,
	BoundaryData,
	Dataset,
	Datasets,
	SelectedArea,
} from "@lib/types";
import { BoundaryData as BoundaryDataBoundaries } from "@lib/types/boundaries";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import { MapOptions } from "@/lib/types/mapOptions";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { PanelContext } from "@/lib/context/PanelContext";
import { ExcludedCategoriesContext } from "@/lib/context/ExcludedCategoriesContext";

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
	boundaryCodes: BoundaryCodes;
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

function MapIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
			<line x1="9" y1="3" x2="9" y2="18" />
			<line x1="15" y1="6" x2="15" y2="21" />
		</svg>
	);
}

function BarChartIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
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
	boundaryCodes,
	mapOptions,
	codeMapper,
	mapManager,
	onMapOptionsChange,
	onLocationClick,
	onZoomIn,
	onZoomOut,
	onExport,
}: UIOverlayProps) {
	const [mobilePanel, setMobilePanel] = useState<
		"none" | "control" | "chart"
	>("none");

	const panelContextValue = { selectedArea, selectedLocation };

	const excludedCategories = useMemo(() => ({
		excludedGeneralParties: new Set(mapOptions.generalElection.excluded ?? []),
		selectedGeneralParty:
			mapOptions.generalElection.mode === "percentage"
				? mapOptions.generalElection.selected
				: undefined,
		excludedLocalParties: new Set(mapOptions.localElection.excluded ?? []),
		selectedLocalParty:
			mapOptions.localElection.mode === "percentage"
				? mapOptions.localElection.selected
				: undefined,
		excludedEthnicities: new Set(mapOptions.ethnicity.excluded ?? []),
		selectedEthnicity:
			mapOptions.ethnicity.mode === "percentage"
				? mapOptions.ethnicity.selected
				: undefined,
		excludedPointValues: new Set(mapOptions.custom.excludedPointValues ?? []),
		selectedPointValue: mapOptions.custom.selectedPointValue,
	}), [
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
	]);

	const handleLocationClick = (loc: string) => {
		onLocationClick(loc);
		setMobilePanel("none");
	};

	const controlPanel = (
		<ControlPanel
			populationDataset={datasets["population"][2022]}
			selectedLocation={selectedLocation}
			onLocationClick={handleLocationClick}
			onZoomIn={onZoomIn}
			onZoomOut={onZoomOut}
			handleMapOptionsChange={onMapOptionsChange}
			onExport={onExport}
		/>
	);

	const bd = boundaryData as unknown as BoundaryDataBoundaries;

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
				boundaryCodes={boundaryCodes}
				codeMapper={codeMapper}
				mapManager={mapManager}
				location={selectedLocation}
			/>
		</ExcludedCategoriesContext.Provider>
	);

	const isDark = mapOptions.baseStyle.id === "darkMatter";

	return (
		<PanelContext.Provider value={panelContextValue}>
				<div className="fixed inset-0 z-50 size-full pointer-events-none">
					{/* Desktop layout */}
					<div className="hidden md:flex absolute left-0 h-full">
						{controlPanel}
					</div>
					<div className="hidden md:flex absolute right-0 h-full">
						<LegendPanel
							activeDataset={activeDataset}
							activeViz={activeViz}
							mapOptions={mapOptions}
							onMapOptionsChange={onMapOptionsChange}
							mapManager={mapManager}
							boundaryData={bd}
							location={selectedLocation}
							datasets={datasets}
						/>
						{chartPanel}
					</div>

					{/* Mobile: bottom sheet overlay */}
					{mobilePanel !== "none" && (
						<button
							type="button"
							className="md:hidden fixed inset-0 bg-black/30 pointer-events-auto z-10"
							aria-label="Close panel"
							onClick={() => setMobilePanel("none")}
						/>
					)}
					<div
						className={`md:hidden fixed bottom-0 left-0 right-0 pointer-events-auto z-20 transition-transform duration-300 ease-in-out ${
							mobilePanel !== "none"
								? "translate-y-0"
								: "translate-y-full"
						}`}
						style={{ maxHeight: "80vh" }}
					>
						<div className={`backdrop-blur-md rounded-t-2xl shadow-2xl border-t overflow-y-auto h-full ${isDark ? "bg-[rgba(12,12,24,0.92)] border-white/10" : "bg-white/95 border-white/30"}`}>
							<div className={`flex items-center justify-between px-4 py-3 border-b sticky top-0 backdrop-blur-md ${isDark ? "bg-[rgba(12,12,24,0.92)] border-white/10" : "bg-white/95 border-gray-100"}`}>
								<span className={`text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-700"}`}>
									{mobilePanel === "control"
										? "Navigation"
										: "Data"}
								</span>
								<button
									type="button"
									onClick={() => setMobilePanel("none")}
									className={`p-1 rounded-full ${isDark ? "text-gray-400 hover:text-gray-200 hover:bg-white/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
								>
									<XIcon />
								</button>
							</div>
							<div className="overflow-y-auto">
								{mobilePanel === "control" && controlPanel}
								{mobilePanel === "chart" && chartPanel}
							</div>
						</div>
					</div>

					{/* Mobile: floating toggle buttons */}
					<div className="md:hidden fixed bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-auto z-30">
						<button
							type="button"
							onClick={() =>
								setMobilePanel(
									mobilePanel === "control"
										? "none"
										: "control",
								)
							}
							className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
								mobilePanel === "control"
									? "bg-indigo-600 text-white"
									: isDark ? "bg-white/10 backdrop-blur-sm text-gray-200 hover:bg-white/15" : "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
							}`}
						>
							<MapIcon />
							<span>Explore</span>
						</button>
						<button
							type="button"
							onClick={() =>
								setMobilePanel(
									mobilePanel === "chart" ? "none" : "chart",
								)
							}
							className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
								mobilePanel === "chart"
									? "bg-indigo-600 text-white"
									: isDark ? "bg-white/10 backdrop-blur-sm text-gray-200 hover:bg-white/15" : "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
							}`}
						>
							<BarChartIcon />
							<span>Data</span>
						</button>
					</div>
				</div>
		</PanelContext.Provider>
	);
}
