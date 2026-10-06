"use client";

import { ChartCard, ChartCardHeaderNote } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import type {
	AggregatedSchoolPerformanceData,
	SchoolPerformanceDataset,
	SchoolPerformanceLADData,
} from "@/lib/types/schoolPerformance";

const MEASURES = {
	grade4: {
		key: "ptL2basics94",
		label: "grade 4+",
		unit: "% grade 4+",
		max: 100,
	},
	grade5: {
		key: "ptL2basics95",
		label: "grade 5+",
		unit: "% grade 5+",
		max: 100,
	},
	attainment8: {
		key: "avgAtt8",
		label: "Attainment 8",
		unit: "Attainment 8",
		max: 70,
	},
	progress8: {
		key: "avgP8score",
		label: "Progress 8",
		unit: "Progress 8",
		max: 1,
	},
} as const;

function statsForArea(
	dataset: SchoolPerformanceDataset,
	aggregated: Record<number, AggregatedSchoolPerformanceData> | null,
	selectedArea: ChartComponentProps["selectedArea"],
	codeMapper: LadResolver | undefined,
): SchoolPerformanceLADData | AggregatedSchoolPerformanceData | null {
	if (!selectedArea) return aggregated?.[dataset.year] ?? null;
	const code = selectedAreaLadCode(selectedArea, codeMapper);
	return code ? (dataset.data[code] ?? null) : null;
}

export default function SchoolPerformanceChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const isDark = useIsDark();
	const measure = useCurrentMapOptions().schoolPerformance.measure;
	const measureInfo = MEASURES[measure];
	const dataset = (
		availableDatasets as Record<string, SchoolPerformanceDataset>
	)[year];
	if (!dataset) return null;
	const stats = statsForArea(
		dataset,
		aggregatedData as Record<
			number,
			AggregatedSchoolPerformanceData
		> | null,
		selectedArea,
		codeMapper,
	);
	const value = stats?.[measureInfo.key];
	const color = useHeatmapValueColor("schoolPerformance", value);
	const hasData = value != null;

	return (
		<ChartCard
			heading={`GCSE Performance, ${measureInfo.label} [2024/25]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			headerEnd={
				<ChartCardHeaderNote isDark={isDark}>
					England
				</ChartCardHeaderNote>
			}
			accent={hasData ? color : null}
			isActive={
				activeDataset?.type === "schoolPerformance" &&
				activeDataset.id === dataset.id
			}
			title="Department for Education. Key Stage 4 Performance 2024/25. explore-education-statistics.service.gov.uk"
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
				value={hasData ? value.toFixed(1) : "—"}
				unit={measureInfo.unit}
				secondary={
					measure === "grade4" && stats?.ptL2basics95 != null
						? `${stats.ptL2basics95.toFixed(1)}% grade 5+`
						: undefined
				}
				barWidth={
					hasData
						? Math.max(
								0,
								Math.min(100, (value / measureInfo.max) * 100),
							)
						: 0
				}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
