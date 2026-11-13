"use client";
import type { AggregatedIMDData, IMDLSOAData, IMDDataset } from "@lib/types";
import type { DeprivationChartProps } from "../createDeprivationChart";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { declaredMeasure } from "@/lib/datasets/declared";
import { resolveDeprivation } from "../deprivationStats";
import type { DeprivationIndex } from "../DeprivationChart";
import { createDeprivationChart } from "../createDeprivationChart";

/** The seven domains, whose scores the card shows beside the overall score. */
type DomainScore = keyof NonNullable<AggregatedIMDData["domainScores"]>;

const IMD: DeprivationIndex = {
	datasetType: "imd",
	label: "IMD",
	region: "England",
	attribution:
		"Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025. gov.uk",
	metric: "score",
	metricMaximum: 92.735,
	areaNoun: "LSOAs",
};

const OverallIMDChart = createDeprivationChart<
	IMDDataset,
	IMDLSOAData,
	AggregatedIMDData
>({
	index: IMD,
	fineAreaType: "lsoa",
	authorityStats: (dataset) => dataset.ladStats,
	areaView: (record) => ({
		decile: record.imdDecile,
		detail: { kind: "score", value: record.imdScore },
	}),
});

export default function IMDChart(
	props: DeprivationChartProps<IMDDataset, AggregatedIMDData>,
) {
	const options = useCurrentMapOptions();
	const { id, label } = declaredMeasure("imd", options)!;
	const measure = id as "imdScore" | DomainScore;
	if (measure === "imdScore") return <OverallIMDChart {...props} />;
	const dataset = props.availableDatasets[props.year];
	if (!dataset) return null;
	const resolved = resolveDeprivation({
		aggregated: props.aggregatedData?.[props.year] ?? null,
		ladStats: dataset.ladStats,
		selectedArea: props.selectedArea,
		fineArea: { type: "lsoa", records: dataset.data },
		codeMapper: props.codeMapper,
	});
	const value =
		resolved?.kind === "area"
			? resolved.record[measure]
			: resolved?.summary.domainScores?.[measure];
	return (
		<ChartCard
			coverage={IMD.region}
			heading={`${label} [${dataset.year}]`}
			accent="#f59e0b"
			isActive={props.activeDataset?.id === dataset.id}
			title="MHCLG. English Indices of Deprivation 2025."
			onClick={() =>
				props.setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={value != null}
				value={value == null ? "" : value.toFixed(3)}
				unit="domain score"
				secondary={
					resolved?.kind === "summary"
						? "Population-weighted average"
						: "LSOA score"
				}
				barWidth={0}
			/>
		</ChartCard>
	);
}
