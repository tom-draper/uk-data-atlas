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
} from "@lib/types";
import LocalElectionResultChartSection from "./local-election/LocalElectionResultChartSection";
import DemographicsChartSection from "./demographics/DemographicsChartSection";
import { memo } from "react";
import EconomicsSection from "./economics/EconomicsSection";
import GeneralElectionResultChartSection from "./general-election/GeneralElectionResultChartSection";
import CrimeSection from "./crime/CrimeSection";
import { CodeType } from "@/lib/hooks/useCodeMapper";
import CustomSection from "./custom/CustomSection";

interface ChartPanelProps {
	selectedLocation: string | null;
	selectedArea: SelectedArea | null;
	activeDataset: Dataset | null;
	boundaryData: BoundaryData;
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	aggregatedData: AggregatedData;
	codeMapper?: {
		getCodeForYear: (
			type: CodeType,
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

const PanelHeader = ({
	selectedLocation,
	selectedArea,
}: {
	selectedLocation: string | null;
	selectedArea: SelectedArea | null;
}) => {
	const { title, subtitle, code } = panelHeaderDetails(
		selectedLocation,
		selectedArea,
	);

	return (
		<div className="pb-2 pt-2.5 px-2.5 bg-white/20">
			<h2 className="font-semibold text-sm">{title}</h2>
			<div className="text-gray-400/80 text-xs">
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
};

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
					? selectedArea.data.localAuthorityName
					: "",
				code: `${selectedArea.data ? selectedArea.data.localAuthorityCode : ""} ${selectedArea.code}`,
			};
		case "constituency":
			return {
				title: selectedArea.data
					? (selectedArea.data.constituencyName ?? "")
					: "",
				subtitle: `${selectedArea.data ? (selectedArea.data.regionName ?? "") : ""}, ${selectedArea.data ? (selectedArea.data.countryName ?? "") : ""}`,
				code: selectedArea.code,
			};
		case "localAuthority":
			return {
				title: selectedArea.data
					? (selectedArea.data.localAuthorityName ?? "")
					: "",
				subtitle: `${selectedArea.data ? (selectedArea.data.regionName ?? "") : ""}, ${selectedArea.data ? (selectedArea.data.countryName ?? "") : ""}`,
				code: selectedArea.code,
			};
	}
}

const PanelFooter = () => {
	const version = packageJson.version;

	return (
		<div className="text-[9px] px-2.5 pb-1.5 text-gray-400/80 bg-white/20 pt-2 mt-auto flex">
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

export default memo(function ChartPanel({
	selectedLocation,
	selectedArea,
	activeDataset,
	boundaryData,
	datasets,
	activeViz,
	setActiveViz,
	aggregatedData,
	codeMapper,
}: ChartPanelProps) {
	return (
		<div className="pointer-events-auto p-2.5 flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg h-full flex flex-col border border-white/30">
				<PanelHeader
					selectedLocation={selectedLocation}
					selectedArea={selectedArea}
				/>

				<div className="space-y-2.5 flex-1 px-2.5 overflow-y-auto scroll-container">
					<GeneralElectionResultChartSection
						activeDataset={activeDataset}
						availableDatasets={datasets.generalElection}
						aggregatedData={aggregatedData.generalElection}
						selectedArea={selectedArea}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
					/>
					<LocalElectionResultChartSection
						activeDataset={activeDataset}
						availableDatasets={datasets.localElection}
						aggregatedData={aggregatedData.localElection}
						selectedArea={selectedArea}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
					/>
					<DemographicsChartSection
						availablePopulationDatasets={datasets.population}
						aggregatedPopulationData={aggregatedData.population}
						availableEthnicityDatasets={datasets.ethnicity}
						aggregatedEthnicityData={aggregatedData.ethnicity}
						boundaryData={boundaryData}
						selectedArea={selectedArea}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
					/>
					<EconomicsSection
						activeDataset={activeDataset}
						availableHousePriceDatasets={datasets.housePrice}
						aggregatedHousePriceData={aggregatedData.housePrice}
						availableIncomeDatasets={datasets.income}
						aggregatedIncomeData={aggregatedData.income}
						selectedArea={selectedArea}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
					/>
					<CrimeSection
						activeDataset={activeDataset}
						availableDatasets={datasets.crime}
						aggregatedData={aggregatedData.crime}
						selectedArea={selectedArea}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
					/>
					<CustomSection
						activeDataset={activeDataset}
						availableDatasets={datasets.crime}
						aggregatedData={aggregatedData.crime}
						selectedArea={selectedArea}
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
						boundaryData={boundaryData}
					/>
				</div>

				<PanelFooter />
			</div>
		</div>
	);
});
