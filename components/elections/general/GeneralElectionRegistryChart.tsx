"use client";
import {
	ActiveViz,
	AggregatedGeneralElectionData,
	Dataset,
	GeneralElectionDataset,
	SelectedArea,
} from "@lib/types";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { computeGeneralElectionYearData } from "@/lib/helpers/generalElection";
import GeneralElectionResultChart from "./GeneralElectionResultChart";

interface GeneralElectionRegistryChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	aggregatedData: Record<number, AggregatedGeneralElectionData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeYearResolver;
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
	const isActive =
		activeDataset?.type === "generalElection" &&
		activeDataset.id === `generalElection-${year}`;

	const data = computeGeneralElectionYearData(
		year,
		availableDatasets?.[year],
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		// The legend filter belongs to the dataset on the map, so other years
		// keep showing their full results.
		isActive ? excludedGeneralParties : undefined,
		isActive ? selectedGeneralParty : undefined,
	);

	return (
		<GeneralElectionResultChart
			data={data}
			isActive={isActive}
			setActiveViz={setActiveViz}
		/>
	);
}
