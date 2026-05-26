// components/ChartPanel.tsx
"use client";
import packageJson from "../package.json";
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
import { memo, useCallback, useState } from "react";
import EconomicsSection from "./economics/EconomicsSection";
import GeneralElectionResultChartSection from "./general-election/GeneralElectionResultChartSection";
import SocietySection from "./society/SocietySection";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import BrexitSection from "./referendum/BrexitSection";
import CustomSection from "./custom/CustomSection";
import EducationSection from "./education/EducationSection";
import { usePanelContext } from "@/lib/context/PanelContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
import { ChartLoadingProvider } from "./ChartLoadingPlaceholder";
import { ChartVisibilityProvider, CHART_CONFIG, useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import ChartSettings from "./ChartSettings";

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

function CogIcon({ className }: { className?: string }) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

const PanelHeader = memo(function PanelHeader({
	settingsOpen,
	onToggleSettings,
}: {
	settingsOpen: boolean;
	onToggleSettings: () => void;
}) {
	const { selectedArea, selectedLocation } = usePanelContext();
	const isDark = useIsDark();
	const t = panelTheme(isDark);
	const { title, subtitle, code } = panelHeaderDetails(
		selectedLocation,
		selectedArea,
	);

	return (
		<div className={`pb-2 pt-2.5 px-2.5 ${t.section}`}>
			<div className="flex items-center justify-between">
				<h2 className={`font-semibold text-sm ${t.heading}`}>{title}</h2>
				<button
					onClick={onToggleSettings}
					className={`p-0.5 rounded transition-colors cursor-pointer ${settingsOpen ? "text-indigo-400" : `${t.textMuted} hover:${isDark ? "text-gray-200" : "text-gray-600"}`}`}
					title="Chart settings"
				>
					<CogIcon className="w-3.5 h-3.5" />
				</button>
			</div>
			<div className={`${t.textMuted} text-xs`}>
				{code ? (
					<div className="flex justify-between">
						<span>{subtitle}</span>
						<span>{code}</span>
					</div>
				) : (
					subtitle
				)}
			</div>
		</div>
	);
});

function panelHeaderDetails(
	selectedLocation: string | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea == null) {
		return {
			title: selectedLocation || "",
			subtitle: "United Kingdom",
			code: "",
		};
	}

	switch (selectedArea.type) {
		case "ward":
			return {
				title:
					selectedArea.name ??
					(selectedArea.data ? selectedArea.data.wardName : ""),
				subtitle: selectedArea.data
					? (selectedArea.data.ladName ?? "")
					: "",
				code: `${selectedArea.data ? (selectedArea.data.ladCode ?? "") : ""} ${selectedArea.code}`,
			};
		case "constituency":
			return {
				title: selectedArea.name || (selectedArea.data?.constituencyName ?? ""),
				subtitle: selectedArea.data
					? [selectedArea.data.regionName, selectedArea.data.countryName].filter(Boolean).join(", ")
					: "",
				code: selectedArea.code,
			};
		case "localAuthority":
			return {
				title: selectedArea.name || (selectedArea.data?.ladName ?? ""),
				subtitle: selectedArea.data
					? [selectedArea.data.regionName, selectedArea.data.countryName].filter(Boolean).join(", ")
					: "",
				code: selectedArea.code,
			};
		case "lsoa":
			return {
				title: selectedArea.name || selectedArea.code,
				subtitle: "LSOA",
				code: selectedArea.code,
			};
	}
}

const PanelFooter = () => {
	const version = packageJson.version;
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div className={`text-[9px] px-2.5 pb-1.5 ${t.textMuted} ${t.section} pt-2 mt-auto flex`}>
			<a
				className="hover:underline cursor-pointer mr-auto"
				href="https://github.com/tom-draper/uk-data-atlas"
			>
				UK Data Atlas v{version}
			</a>
			<a className="hover:underline cursor-pointer" href="/sources">
				View Sources
			</a>
		</div>
	);
};

function useSectionVisibility() {
	const { visibility } = useChartVisibility();
	const byGroup: Record<string, boolean> = {};
	for (const { group, key } of CHART_CONFIG) {
		if (visibility[key]) byGroup[group] = true;
	}
	return byGroup;
}

export default memo(function ChartPanel({
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
	const toggleSettings = useCallback(() => setSettingsOpen((o) => !o), []);

	return (
		<ChartVisibilityProvider>
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div className={`rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border ${t.panel}`}>
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
									availableDatasets={datasets.generalElection}
									aggregatedData={aggregatedData.generalElection}
									selectedArea={selectedArea}
									setActiveViz={setActiveViz}
									codeMapper={codeMapper}
									activeViz={activeViz}
								/>
							)}
							{sectionVisible["Local Election"] && (
								<LocalElectionResultChartSection
									activeDataset={activeDataset}
									availableDatasets={datasets.localElection}
									aggregatedData={aggregatedData.localElection}
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
									availableEthnicityDatasets={datasets.ethnicity}
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
									availableIncomeDatasets={datasets.income}
									aggregatedIncomeData={aggregatedData.income}
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
									aggregatedCrimeData={aggregatedData.crime}
									availableIMDDatasets={datasets.imd}
									aggregatedIMDData={aggregatedData.imd}
									availableSIMDDatasets={datasets.simd}
									aggregatedSIMDData={aggregatedData.simd}
									availableWIMDDatasets={datasets.wimd}
									aggregatedWIMDData={aggregatedData.wimd}
									availableNIMDMDatasets={datasets.nimdm}
									aggregatedNIMDMData={aggregatedData.nimdm}
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
									availableQualificationDatasets={datasets.qualification}
									aggregatedQualificationData={aggregatedData.qualification}
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
});
