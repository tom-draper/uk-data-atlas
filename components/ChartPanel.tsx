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
import LocalElectionResultChartSection from "./local-election/LocalElectionResultChartSection";
import DemographicsChartSection from "./demographics/DemographicsChartSection";
import { useState } from "react";
import EconomicsSection from "./economics/EconomicsSection";
import GeneralElectionResultChartSection from "./general-election/GeneralElectionResultChartSection";
import SocietySection from "./society/SocietySection";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import BrexitSection from "./referendum/BrexitSection";
import CustomSection from "./custom/CustomSection";
import EducationSection from "./education/EducationSection";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
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
	const t = panelTheme(isDark);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const sectionVisible = useSectionVisibility();
	const toggleSettings = () => setSettingsOpen((o) => !o);

	return (
		<ChartVisibilityProvider>
			<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
				<div
					className={`rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border ${t.panel}`}
				>
					<PanelHeader
						settingsOpen={settingsOpen}
						onToggleSettings={toggleSettings}
					/>

					{settingsOpen ? (
						<ChartSettings />
					) : (
						<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container">
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
										availableHousePriceDatasets={
											datasets.housePrice
										}
										aggregatedHousePriceData={
											aggregatedData.housePrice
										}
										availableIncomeDatasets={
											datasets.income
										}
										aggregatedIncomeData={
											aggregatedData.income
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
										activeViz={activeViz}
									/>
								)}
								{sectionVisible["Society"] && (
									<SocietySection
										activeDataset={activeDataset}
										availableCrimeDatasets={datasets.crime}
										aggregatedCrimeData={
											aggregatedData.crime
										}
										availableIMDDatasets={datasets.imd}
										aggregatedIMDData={aggregatedData.imd}
										availableSIMDDatasets={datasets.simd}
										aggregatedSIMDData={aggregatedData.simd}
										availableWIMDDatasets={datasets.wimd}
										aggregatedWIMDData={aggregatedData.wimd}
										availableNIMDMDatasets={datasets.nimdm}
										aggregatedNIMDMData={
											aggregatedData.nimdm
										}
										availableLifeExpectancyDatasets={
											datasets.lifeExpectancy
										}
										aggregatedLifeExpectancyData={
											aggregatedData.lifeExpectancy
										}
										selectedArea={selectedArea}
										setActiveViz={setActiveViz}
										codeMapper={codeMapper}
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
		</ChartVisibilityProvider>
	);
}
