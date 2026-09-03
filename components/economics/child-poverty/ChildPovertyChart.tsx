"use client";
import {
	ActiveViz,
	AggregatedChildPovertyData,
	ChildPovertyDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface ChildPovertyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, ChildPovertyDataset>;
	aggregatedData: Record<number, AggregatedChildPovertyData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const accentForRate = (rate: number) =>
	rate >= 30
		? "#dc2626"
		: rate >= 20
			? "#f97316"
			: rate >= 12
				? "#eab308"
				: "#16a34a";
const formatCount = (value: number) =>
	value >= 1_000_000
		? `${(value / 1_000_000).toFixed(1)}m`
		: `${Math.round(value / 1_000)}k`;

function statsFor(
	dataset: ChildPovertyDataset,
	aggregatedData: Record<number, AggregatedChildPovertyData> | null,
	selectedArea: SelectedArea | null,
	codeMapper?: CodeMapper,
): AggregatedChildPovertyData | null {
	if (!selectedArea) return aggregatedData?.[dataset.year] ?? null;
	const code =
		selectedArea.type === "localAuthority"
			? selectedArea.code
			: selectedArea.type === "ward"
				? selectedArea.data?.ladCode
				: undefined;
	if (!code) return null;
	const record =
		dataset.data[code] ??
		dataset.data[
			codeMapper?.getCodeForYear(
				"localAuthority",
				code,
				dataset.boundaryYear,
			) ?? ""
		];
	return record
		? {
				childCount: record.childCount,
				childPovertyRate: record.childPovertyRate,
			}
		: null;
}

export default function ChildPovertyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChildPovertyChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets[year];
	const stats = dataset
		? statsFor(dataset, aggregatedData, selectedArea, codeMapper)
		: null;
	const active =
		activeDataset?.type === "childPoverty" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const rate = stats?.childPovertyRate ?? 0;
	const accent = hasData ? accentForRate(rate) : null;
	const color = accent ?? undefined;
	if (!dataset) return null;

	// Rates above 40% are uncommon; cap the bar there to retain contrast.
	const barWidth = Math.min((rate / 40) * 100, 100);

	return (
		<ChartCard
			heading={`Child Poverty [${year}]`}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England
				</span>
			}
			accent={accent}
			isActive={active}
			title="DWP. Children in relative low-income families, before housing costs."
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
				value={rate.toFixed(1)}
				unit="% children"
				secondary={
					stats
						? `${formatCount(stats.childCount)} affected`
						: undefined
				}
				barWidth={barWidth}
				barColor={color}
			/>
		</ChartCard>
	);
}
