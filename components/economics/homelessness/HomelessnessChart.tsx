"use client";

import {
	ActiveViz,
	AggregatedHomelessnessData,
	Dataset,
	HomelessnessDataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface HomelessnessChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HomelessnessDataset>;
	aggregatedData: Record<number, AggregatedHomelessnessData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function rateColor(rate: number): string {
	if (rate <= 2.5) return "#16a34a";
	if (rate <= 5) return "#eab308";
	if (rate <= 8) return "#f97316";
	return "#dc2626";
}

function formatCount(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return value.toLocaleString();
}

function computeStats(
	dataset: HomelessnessDataset,
	aggregatedData: Record<number, AggregatedHomelessnessData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedHomelessnessData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const record = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!record) return null;
		return {
			householdsInTemporaryAccommodation: record.householdsInTemporaryAccommodation,
			householdsPerThousand: record.householdsPerThousand,
			householdsWithChildren: record.householdsWithChildren,
			childrenInTemporaryAccommodation: record.childrenInTemporaryAccommodation,
		};
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function HomelessnessChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: HomelessnessChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	const stats = dataset ? computeStats(dataset, aggregatedData, selectedArea, codeMapper) : null;
	const isActive = activeDataset?.type === "homelessness" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = rateColor(stats?.householdsPerThousand ?? 0);
	if (!dataset) return null;

	const rate = stats?.householdsPerThousand ?? 0;
	// Bar shows households in temporary accommodation per 1,000 local households.
	const barWidth = Math.min(rate / 15 * 100, 100);

	return (
		<ChartCard
			heading="Homelessness [2026]"
			headingClassName="min-w-0 truncate"
			headingTitle="Homelessness: temporary accommodation [2026]"
			headerEnd={
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
					England
				</span>
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="Ministry of Housing, Communities and Local Government. Statutory homelessness statistics. gov.uk"
			onClick={() => setActiveViz({ vizId: dataset.id, datasetType: dataset.type, datasetYear: dataset.year })}
		>
			<ChartCardValueBar
				hasData={hasData}
				value={rate.toFixed(1)}
				unit="per 1k households"
				secondary={
					stats
						? `${formatCount(stats.householdsInTemporaryAccommodation)} in TA`
						: undefined
				}
				barWidth={barWidth}
				barColor={color}
			/>
		</ChartCard>
	);
}
