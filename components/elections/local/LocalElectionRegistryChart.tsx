"use client";
import {
	ActiveViz,
	AggregatedLocalElectionData,
	Dataset,
	LocalElectionDataset,
	SelectedArea,
} from "@lib/types";
import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { computeLocalElectionYearData } from "@/lib/helpers/localElection";
import LocalElectionResultChart from "./LocalElectionResultChart";

interface LocalElectionRegistryChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	aggregatedData: Record<number, AggregatedLocalElectionData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: PopulationCodeResolver;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function LocalElectionRegistryChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: LocalElectionRegistryChartProps) {
	const { excludedLocalParties, selectedLocalParty } =
		useExcludedCategories();
	const isActive =
		activeDataset?.type === "localElection" &&
		activeDataset.id === `localElection${year}`;

	const data = computeLocalElectionYearData(
		year,
		availableDatasets?.[year],
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		codeMapper?.getWardsForLad,
		codeMapper?.getWardsForConstituency,
		codeMapper?.getMappingGeneration() ?? 0,
		// The legend filter belongs to the dataset on the map, so other years
		// keep showing their full results.
		isActive ? excludedLocalParties : undefined,
		isActive ? selectedLocalParty : undefined,
	);

	return (
		<LocalElectionResultChart
			data={data}
			isActive={isActive}
			setActiveViz={setActiveViz}
		/>
	);
}
