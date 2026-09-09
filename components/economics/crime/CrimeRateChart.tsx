"use client";
import {
	ActiveViz,
	AggregatedCrimeData,
	Dataset,
	CrimeDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";

interface CrimeRateChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: Record<number, AggregatedCrimeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeCrimeRate(
	dataset: CrimeDataset,
	aggregatedData: Record<number, AggregatedCrimeData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
	year: number,
): number | null {
	let rate: number | null = null;
	if (
		selectedArea === null &&
		aggregatedData &&
		aggregatedData[dataset.year]
	) {
		rate = aggregatedData[dataset.year].averageRecordedCrime || null;
	} else if (
		selectedArea &&
		selectedArea.type === "localAuthority" &&
		selectedArea.data
	) {
		const laCode = selectedArea.code;
		rate = dataset.data?.[laCode]?.totalRecordedCrime || null;
		if (!rate && codeMapper) {
			const mappedCode = codeMapper.getCodeForYear(
				"localAuthority",
				laCode,
				year,
			);
			if (mappedCode) {
				rate = dataset.data?.[mappedCode]?.totalRecordedCrime || null;
			}
		}
	}
	return rate;
}

export default function CrimeRateChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: CrimeRateChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const crimeRate = dataset
		? computeCrimeRate(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
				year,
			)
		: null;

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "crime" &&
		activeDataset.id === `crime${dataset.year}`;

	const rawValue = crimeRate || 0;
	const maxThreshold = 100000;

	const hasData = crimeRate !== null && crimeRate > 0;
	// A total above 100,000 offences fills the bar; lower totals remain
	// proportional so small authorities are not visually flattened to zero.
	const intensity = Math.min(rawValue / maxThreshold, 1);

	const color = hasData
		? `hsl(${50 - intensity * 50}, ${50 + intensity * 40}%, 50%)`
		: null;

	return (
		<ChartCard
			heading={`Recorded Crime [${dataset.year}]`}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England &amp; Wales
				</span>
			}
			accent={color}
			isActive={isActive}
			title="Home Office. Police Recorded Crime Open Data Tables. data.police.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={hasData}
				value={Math.round(rawValue).toLocaleString()}
				unit="offences"
				barWidth={intensity * 100}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
