"use client";
import {
	ActiveViz,
	AggregatedClaimantCountData,
	ClaimantCountDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface ClaimantCountChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, ClaimantCountDataset>;
	aggregatedData: Record<number, AggregatedClaimantCountData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function rateColor(rate: number): string {
	if (rate <= 2.5) return "#16a34a";
	if (rate <= 4) return "#eab308";
	if (rate <= 6) return "#f97316";
	return "#dc2626";
}

function computeStats(
	dataset: ClaimantCountDataset,
	aggregatedData: Record<number, AggregatedClaimantCountData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedClaimantCountData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const r = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!r) return null;
		return { totalCount: r.totalCount, totalRate: r.totalRate, youthCount: r.youthCount, youthRate: r.youthRate };
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function ClaimantCountChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ClaimantCountChartProps) {
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive = activeDataset?.type === "claimantCount" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = rateColor(stats?.totalRate ?? 0);

	if (!dataset) return null;

	const rate = stats?.totalRate ?? 0;
	// Bar capped at 10% = full width
	const barWidth = Math.min(rate / 10 * 100, 100);

	return (
		<ChartCard
			heading={`Claimant Count [${year}]`}
			accent={hasData ? color : null}
			isActive={isActive}
			title="ONS/Nomis. Claimant Count (UC + JSA). nomisweb.co.uk"
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
				unit="% of 16-64"
				secondary={stats ? `${stats.youthRate.toFixed(1)}% youth` : undefined}
				barWidth={barWidth}
				barColor={color}
			/>
		</ChartCard>
	);
}
