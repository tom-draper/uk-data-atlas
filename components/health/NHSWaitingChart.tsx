"use client";
import {
	ActiveViz,
	AggregatedNHSWaitingData,
	NHSWaitingDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";

interface NHSWaitingChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, NHSWaitingDataset>;
	aggregatedData: Record<number, AggregatedNHSWaitingData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

// 18-week NHS target: 92% treated within 18 weeks = max 8% over
const TARGET_PCT = 8;

function computeStats(
	dataset: NHSWaitingDataset,
	aggregatedData: Record<number, AggregatedNHSWaitingData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
): AggregatedNHSWaitingData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const getForLad = (ladCode: string) => {
		const icbCode = dataset.ladToIcb[ladCode];
		if (!icbCode) return null;
		const r = dataset.data[icbCode];
		if (!r) return null;
		return {
			total: r.total,
			over18Weeks: r.over18Weeks,
			pctOver18Weeks: r.pctOver18Weeks,
		};
	};

	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	return ladCode ? getForLad(ladCode) : null;
}

export default function NHSWaitingChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: NHSWaitingChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive =
		activeDataset?.type === "nhsWaiting" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = useHeatmapValueColor(
		"nhsWaiting",
		hasData ? stats.pctOver18Weeks : null,
	);

	if (!dataset) return null;

	const pct = stats?.pctOver18Weeks ?? 0;
	// Bar shows % over 18 weeks, capped at 50% for visual scale
	const barWidth = Math.min((pct / 50) * 100, 100);

	return (
		<ChartCard
			heading={`NHS Waiting Times [${dataset.year}]`}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England
				</span>
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="NHS England. Referral to Treatment waiting times. england.nhs.uk"
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
				value={pct.toFixed(1)}
				unit="% over 18 wks"
				secondary={<>target &lt;{TARGET_PCT}%</>}
				barWidth={barWidth}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
