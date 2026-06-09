// components/ChartPanel.tsx
"use client";
import { Dataset, Datasets, ActiveViz, SelectedArea, BoundaryData, BoundaryCodes } from "@lib/types";
import { BoundaryData as BoundaryDataBoundaries } from "@lib/types/boundaries";
import { CustomDataset } from "@/lib/types/custom";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import LocalElectionResultChartSection from "./elections/local/LocalElectionResultChartSection";
import DemographicsChartSection from "./demographics/DemographicsChartSection";
import { useState, useDeferredValue } from "react";
import EconomicsSection from "./economics/EconomicsSection";
import GeneralElectionResultChartSection from "./elections/general/GeneralElectionResultChartSection";
import DeprivationSection from "./deprivation/DeprivationSection";
import HealthSection from "./health/HealthSection";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import BrexitSection from "./elections/referendum/BrexitSection";
import CustomSection from "./custom/CustomSection";
import EducationSection from "./education/EducationSection";
import TelecomsSection from "./telecoms/TelecomsSection";
import EnvironmentSection from "./environment/EnvironmentSection";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import { ChartLoadingProvider } from "./ChartLoadingPlaceholder";
import {
	ChartVisibilityProvider,
	CHART_CONFIG,
	useChartVisibility,
} from "@/lib/context/ChartVisibilityContext";
import ChartSettings from "./ChartSettings";
import PanelHeader from "./PanelHeader";
import PanelFooter from "./PanelFooter";

interface ChartPanelProps {
	selectedArea: SelectedArea | null;
	activeDataset: Dataset | null;
	boundaryData: BoundaryData;
	boundaryCodes: BoundaryCodes;
	datasets: Datasets;
	customDataset: CustomDataset | null;
	setCustomDataset: (dataset: CustomDataset | null) => void;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	chartsLoading: boolean;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	location: string;
}

function useSectionVisibility() {
	const { visibility } = useChartVisibility();
	const byGroup: Record<string, boolean> = {};
	for (const { group, key } of CHART_CONFIG) {
		if (visibility[key]) byGroup[group] = true;
	}
	return byGroup;
}

export default function ChartPanel({
	selectedArea,
	activeDataset,
	boundaryData,
	boundaryCodes,
	datasets,
	customDataset,
	setCustomDataset,
	activeViz,
	setActiveViz,
	chartsLoading,
	codeMapper,
	mapManager,
	location,
}: ChartPanelProps) {
	const isDark = useIsDark();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const sectionVisible = useSectionVisibility();
	const deferredArea = useDeferredValue(selectedArea);
	const toggleSettings = () => setSettingsOpen((o) => !o);

	// BoundaryData from @lib/types is the same shape as @lib/types/boundaries
	const bd = boundaryData as unknown as BoundaryDataBoundaries;

	return (
		<ChartVisibilityProvider>
			<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
				<div
					className={`rounded-md h-full flex flex-col relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
					style={glassStyle(isDark)}
				>
					<GlassOverlays isDark={isDark} />
					<div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
					<PanelHeader
						settingsOpen={settingsOpen}
						onToggleSettings={toggleSettings}
					/>

					{settingsOpen ? (
						<ChartSettings />
					) : (
						<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container [&>*:first-child]:border-t-0">
							<ChartLoadingProvider loading={chartsLoading}>
								{sectionVisible["General Election"] && (
									<GeneralElectionResultChartSection
										activeDataset={activeDataset}
										availableDatasets={datasets.generalElection}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Local Election"] && (
									<LocalElectionResultChartSection
										activeDataset={activeDataset}
										availableDatasets={datasets.localElection}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Brexit"] && (
									<BrexitSection
										activeDataset={activeDataset}
										availableDatasets={datasets.brexit}
										availableConstituencyDatasets={datasets.brexitConstituency}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Demographics"] && (
									<DemographicsChartSection
										availablePopulationDatasets={datasets.population}
										availableEthnicityDatasets={datasets.ethnicity}
										boundaryData={boundaryData}
										selectedArea={deferredArea}
										activeViz={activeViz}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										mapManager={mapManager}
										location={location}
									/>
								)}
								{sectionVisible["Economics"] && (
									<EconomicsSection
										activeDataset={activeDataset}
										availableHousePriceDatasets={datasets.housePrice}
										availableIncomeDatasets={datasets.income}
										availableCrimeDatasets={datasets.crime}
										availableClaimantCountDatasets={datasets.claimantCount}
										availableUnemploymentDatasets={datasets.unemployment}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Deprivation"] && (
									<DeprivationSection
										activeDataset={activeDataset}
										availableIMDDatasets={datasets.imd}
										availableSIMDDatasets={datasets.simd}
										availableWIMDDatasets={datasets.wimd}
										availableNIMDMDatasets={datasets.nimdm}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Health"] && (
									<HealthSection
										activeDataset={activeDataset}
										availableLifeExpectancyDatasets={datasets.lifeExpectancy}
										availableNHSWaitingDatasets={datasets.nhsWaiting}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Education"] && (
									<EducationSection
										activeDataset={activeDataset}
										availableQualificationDatasets={datasets.qualification}
										availableSchoolPerformanceDatasets={datasets.schoolPerformance}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Telecoms"] && (
									<TelecomsSection
										activeDataset={activeDataset}
										availableBroadbandDatasets={datasets.broadband}
										selectedArea={deferredArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								{sectionVisible["Environment"] && (
									<EnvironmentSection
										activeDataset={activeDataset}
										availableAirQualityDatasets={datasets.airQuality}
										selectedArea={deferredArea}
										activeViz={activeViz}
										setActiveViz={setActiveViz}
										mapManager={mapManager}
										boundaryData={bd}
										location={location}
									/>
								)}
								<CustomSection
									customDataset={customDataset}
									setCustomDataset={setCustomDataset}
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
		</ChartVisibilityProvider>
	);
}
