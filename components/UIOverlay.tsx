import { memo, useMemo, useState } from "react";
import ControlPanel from "@components/ControlPanel";
import LegendPanel from "@components/LegendPanel";
import ChartPanel from "@components/ChartPanel";
import type {
	ActiveViz,
	AggregatedData,
	BoundaryCodes,
	BoundaryData,
	Dataset,
	Datasets,
	SelectedArea,
} from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import { MapOptions } from "@/lib/types/mapOptions";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { PanelContext } from "@/lib/context/PanelContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";

interface UIOverlayProps {
	datasets: Datasets;
	customDataset: CustomDataset | null;
	setCustomDataset: (dataset: CustomDataset | null) => void;
	activeDataset: Dataset | null;
	aggregatedData: AggregatedData;
	chartsLoading: boolean;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	selectedArea: SelectedArea | null;
	boundaryData: BoundaryData;
	boundaryCodes: BoundaryCodes;
	mapOptions: MapOptions;
	codeMapper?: CodeMapper;
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
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
			<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
			<line x1="9" y1="3" x2="9" y2="18" />
			<line x1="15" y1="6" x2="15" y2="21" />
		</svg>
	);
}

function BarChartIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

export default memo(function UIOverlay({
	datasets,
	customDataset,
	setCustomDataset,
	activeDataset,
	activeViz,
	setActiveViz,
	aggregatedData,
	chartsLoading,
	selectedLocation,
	selectedArea,
	boundaryData,
	boundaryCodes,
	mapOptions,
	codeMapper,
	onMapOptionsChange,
	onLocationClick,
	onZoomIn,
	onZoomOut,
	onExport,
}: UIOverlayProps) {
	const [mobilePanel, setMobilePanel] = useState<"none" | "control" | "chart">("none");

	const panelContextValue = useMemo(
		() => ({ selectedArea, selectedLocation }),
		[selectedArea, selectedLocation],
	);

	const controlPanel = (
		<ControlPanel
			populationDataset={datasets["population"][2022]}
			selectedLocation={selectedLocation}
			onLocationClick={(loc) => {
				onLocationClick(loc);
				setMobilePanel("none");
			}}
			onZoomIn={onZoomIn}
			onZoomOut={onZoomOut}
			handleMapOptionsChange={onMapOptionsChange}
			onExport={onExport}
		/>
	);

	const chartPanel = (
		<ChartPanel
			datasets={datasets}
			customDataset={customDataset}
			setCustomDataset={setCustomDataset}
			activeViz={activeViz}
			setActiveViz={setActiveViz}
			activeDataset={activeDataset}
			aggregatedData={aggregatedData}
			chartsLoading={chartsLoading}
			selectedArea={selectedArea}
			boundaryData={boundaryData}
			boundaryCodes={boundaryCodes}
			codeMapper={codeMapper}
		/>
	);

	const isDark = mapOptions.baseStyle.id === "darkMatter";

	return (
		<ThemeProvider value={isDark}>
		<PanelContext.Provider value={panelContextValue}>
			<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">

				{/* Desktop layout */}
				<div className="hidden md:flex absolute left-0 h-full">
					{controlPanel}
				</div>
				<div className="hidden md:flex absolute right-0 h-full">
					<LegendPanel
						activeDataset={activeDataset}
						activeViz={activeViz}
						aggregatedData={aggregatedData}
						mapOptions={mapOptions}
						onMapOptionsChange={onMapOptionsChange}
					/>
					{chartPanel}
				</div>

				{/* Mobile: bottom sheet overlay */}
				{mobilePanel !== "none" && (
					<div
						className="md:hidden fixed inset-0 bg-black/30 pointer-events-auto z-10"
						onClick={() => setMobilePanel("none")}
					/>
				)}
				<div
					className={`md:hidden fixed bottom-0 left-0 right-0 pointer-events-auto z-20 transition-transform duration-300 ease-in-out ${
						mobilePanel !== "none" ? "translate-y-0" : "translate-y-full"
					}`}
					style={{ maxHeight: "80vh" }}
				>
					<div className="bg-white/95 backdrop-blur-md rounded-t-2xl shadow-2xl border-t border-white/30 overflow-y-auto h-full">
						<div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md">
							<span className="text-sm font-semibold text-gray-700">
								{mobilePanel === "control" ? "Navigation" : "Data"}
							</span>
							<button
								onClick={() => setMobilePanel("none")}
								className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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
						onClick={() => setMobilePanel(mobilePanel === "control" ? "none" : "control")}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
							mobilePanel === "control"
								? "bg-indigo-600 text-white"
								: "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
						}`}
					>
						<MapIcon />
						<span>Explore</span>
					</button>
					<button
						onClick={() => setMobilePanel(mobilePanel === "chart" ? "none" : "chart")}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
							mobilePanel === "chart"
								? "bg-indigo-600 text-white"
								: "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
						}`}
					>
						<BarChartIcon />
						<span>Data</span>
					</button>
				</div>
			</div>
		</PanelContext.Provider>
		</ThemeProvider>
	);
});
