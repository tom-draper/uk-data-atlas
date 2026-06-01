// components/ChartPanel.tsx
"use client";
import {
	Dataset,
	Datasets,
	ActiveViz,
	AggregatedData,
	SelectedArea,
	BoundaryData,
	BoundaryCodes,
} from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import LocalElectionResultChartSection from "./elections/local/LocalElectionResultChartSection";
import DemographicsChartSection from "./demographics/DemographicsChartSection";
import { useState } from "react";
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
	aggregatedData: AggregatedData;
	chartsLoading: boolean;
	codeMapper?: CodeMapper;
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
	aggregatedData,
	chartsLoading,
	codeMapper,
}: ChartPanelProps) {
	const isDark = useIsDark();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const sectionVisible = useSectionVisibility();
	const toggleSettings = () => setSettingsOpen((o) => !o);

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
										availableDatasets={
											datasets.generalElection
										}
										aggregatedData={
											aggregatedData.generalElection
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Local Election"] && (
									<LocalElectionResultChartSection
										activeDataset={activeDataset}
										availableDatasets={
											datasets.localElection
										}
										aggregatedData={
											aggregatedData.localElection
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Brexit"] && (
									<BrexitSection
										activeDataset={activeDataset}
										availableDatasets={datasets.brexit}
										availableConstituencyDatasets={
											datasets.brexitConstituency
										}
										aggregatedData={aggregatedData.brexit}
										aggregatedConstituencyData={
											aggregatedData.brexitConstituency
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Demographics"] && (
									<DemographicsChartSection
										availablePopulationDatasets={
											datasets.population
										}
										aggregatedPopulationData={
											aggregatedData.population
										}
										availableEthnicityDatasets={
											datasets.ethnicity
										}
										aggregatedEthnicityData={
											aggregatedData.ethnicity
										}
										boundaryData={boundaryData}
										selectedArea={selectedArea}
										activeViz={activeViz}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
									/>
								)}
								{sectionVisible["Economics"] && (
									<EconomicsSection
										activeDataset={activeDataset}
										availableHousePriceDatasets={datasets.housePrice}
										aggregatedHousePriceData={aggregatedData.housePrice}
										availableIncomeDatasets={datasets.income}
										aggregatedIncomeData={aggregatedData.income}
										availableCrimeDatasets={datasets.crime}
										aggregatedCrimeData={aggregatedData.crime}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Deprivation"] && (
									<DeprivationSection
										activeDataset={activeDataset}
										availableIMDDatasets={datasets.imd}
										aggregatedIMDData={aggregatedData.imd}
										availableSIMDDatasets={datasets.simd}
										aggregatedSIMDData={aggregatedData.simd}
										availableWIMDDatasets={datasets.wimd}
										aggregatedWIMDData={aggregatedData.wimd}
										availableNIMDMDatasets={datasets.nimdm}
										aggregatedNIMDMData={aggregatedData.nimdm}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Health"] && (
									<HealthSection
										activeDataset={activeDataset}
										availableLifeExpectancyDatasets={datasets.lifeExpectancy}
										aggregatedLifeExpectancyData={aggregatedData.lifeExpectancy}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Education"] && (
									<EducationSection
										activeDataset={activeDataset}
										availableQualificationDatasets={
											datasets.qualification
										}
										aggregatedQualificationData={
											aggregatedData.qualification
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Telecoms"] && (
									<TelecomsSection
										activeDataset={activeDataset}
										availableBroadbandDatasets={datasets.broadband}
										aggregatedBroadbandData={aggregatedData.broadband}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Environment"] && (
									<EnvironmentSection
										activeDataset={activeDataset}
										availableAirQualityDatasets={datasets.airQuality}
										aggregatedAirQualityData={aggregatedData.airQuality}
										selectedArea={selectedArea}
										activeViz={activeViz}
										setActiveViz={setActiveViz}
									/>
								)}
									<CustomSection
									customDataset={customDataset}
									setCustomDataset={setCustomDataset}
									aggregatedData={aggregatedData.custom}
									selectedArea={selectedArea}
									activeViz={activeViz}
									setActiveViz={setActiveViz}
									codeMapper={codeMapper}
									boundaryCodes={boundaryCodes}
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
