"use client";
import {
	ActiveViz,
	AggregatedGeneralElectionData,
	Dataset,
	GeneralElectionDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { computeGeneralElectionYearData } from "@/lib/helpers/generalElection";
import GeneralElectionResultChart from "./GeneralElectionResultChart";

interface GeneralElectionRegistryChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	aggregatedData: Record<number, AggregatedGeneralElectionData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function GeneralElectionRegistryChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: GeneralElectionRegistryChartProps) {
	const { excludedGeneralParties, selectedGeneralParty } =
		useExcludedCategories();
	const data = computeGeneralElectionYearData(
		year,
		availableDatasets?.[year],
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		excludedGeneralParties,
		selectedGeneralParty,
	);

	const isActive =
		activeDataset?.type === "generalElection" &&
		activeDataset.id === `generalElection-${year}`;

	return (
		<GeneralElectionResultChart
			data={data}
			isActive={isActive}
			setActiveViz={setActiveViz}
		/>
	);
}
