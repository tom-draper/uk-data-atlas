"use client";
import { ActiveViz, AggregatedLocalElectionData, Dataset, LocalElectionDataset, SelectedArea } from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { computeLocalElectionYearData } from "@/lib/helpers/localElection";
import LocalElectionResultChart from "./LocalElectionResultChart";

interface LocalElectionRegistryChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	aggregatedData: Record<number, AggregatedLocalElectionData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
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
	activeViz,
	setActiveViz,
}: LocalElectionRegistryChartProps) {
	const { excludedLocalParties, selectedLocalParty } = useExcludedCategories();
	const data = computeLocalElectionYearData(
		year,
		availableDatasets?.[year],
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		codeMapper?.getWardsForLad,
		codeMapper?.getWardsForConstituency,
		excludedLocalParties,
		selectedLocalParty,
	);

	const isActive = !!(
		activeDataset &&
		((activeDataset.type === "localElection" &&
			activeDataset.id === `localElection${year}`) ||
			(activeViz.datasetType === "custom" && activeViz.vizId === "custom"))
	);

	return <LocalElectionResultChart data={data} isActive={isActive} setActiveViz={setActiveViz} />;
}
