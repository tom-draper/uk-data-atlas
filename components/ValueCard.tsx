"use client";

import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { ChartDataPlaceholder } from "@/components/ChartDataPlaceholder";
import { MetricPill } from "@/components/MetricPill";
import { IncomeCardBackground } from "@/components/datasets/economy/earnings-and-income/income/IncomeCardBackground";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import type { ValueCardConfig } from "@/lib/datasets/valueCard";
import {
	groupLsoasByLocalAuthority,
	resolveValueCardStats,
} from "@/lib/helpers/valueCardStats";
import { useLsoaToLad } from "@/lib/hooks/useLsoaToLad";
import { useMemo } from "react";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import type { ActiveViz } from "@/lib/types";
import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";

type CardDataset = {
	id: string;
	type: string;
	year: number;
	boundaryType: string;
	boundaryYear: number;
	data: Record<string, unknown>;
};

const formatters = new Map<number, Intl.NumberFormat>();

const formatterFor = (digits: number) => {
	let formatter = formatters.get(digits);
	if (!formatter) {
		formatter = new Intl.NumberFormat("en-GB", {
			maximumFractionDigits: digits,
			minimumFractionDigits: digits,
		});
		formatters.set(digits, formatter);
	}
	return formatter;
};

const formatValue = (config: ValueCardConfig, value: number) => {
	if (config.format) return config.format(value);
	return `${config.prefix ?? ""}${formatterFor(config.digits ?? 0).format(value)}`;
};

/**
 * The shared card for datasets declared with `chart.card`: one headline value,
 * a bar scaled against the card's maximum and an optional secondary note.
 */
export default function ValueCard({
	card: defaultCard,
	cardForOptions,
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const isDark = useIsDark();
	const options = useCurrentMapOptions();
	const card = cardForOptions?.(options) ?? defaultCard;
	const dataset = (
		availableDatasets as Record<string, CardDataset> | undefined
	)?.[year];
	const isActive =
		!!dataset &&
		activeDataset?.type === dataset.type &&
		activeDataset.id === dataset.id;
	const lsoaToLad = useLsoaToLad(
		card?.fromLsoas ? dataset?.boundaryYear : undefined,
	);
	const lsoasByLad = useMemo(
		() =>
			dataset && lsoaToLad
				? groupLsoasByLocalAuthority(dataset.data, lsoaToLad)
				: null,
		[dataset, lsoaToLad],
	);
	const resolved =
		card && dataset
			? resolveValueCardStats(
					card,
					dataset,
					aggregatedData?.[year],
					selectedArea,
					codeMapper,
					isActive,
					lsoasByLad,
				)
			: null;
	const color = useHeatmapValueColor(
		(card?.colorKey ?? dataset?.type) as NumericMapOptionsKey | undefined,
		resolved?.stats.value,
	);
	if (!card || !dataset) return null;

	const heading = `${card.heading} [${card.period ?? dataset.year}]`;
	const value = resolved?.stats.value;

	return (
		<ChartCard
			coverage={formatDatasetCoverage(dataset) ?? card.coverage}
			heading={heading}
			headingClassName="min-w-0 truncate"
			headingTitle={card.headingTitle ?? heading}
			estimateNote={
				isLocalAuthorityEstimate(
					selectedArea,
					resolved?.viaLocalAuthority === true,
				)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={card.accent ?? (resolved ? color : null)}
			background={
				card.background === "income" ? (
					<IncomeCardBackground income={value ?? null} />
				) : undefined
			}
			isActive={isActive}
			title={card.source}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type as ActiveViz["datasetType"],
					datasetYear: dataset.year,
				})
			}
		>
			{card.layout === "pills" ? (
				value === undefined ? (
					<ChartDataPlaceholder />
				) : (
					<div className="flex items-end justify-between gap-1.5 flex-1">
						<div className="flex flex-col gap-0.5">
							<div className="flex items-baseline gap-1">
								<span
									className="text-2xl font-bold leading-none"
									style={{ color: card.accent }}
								>
									{formatValue(card, value)}
								</span>
								<span
									className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									{card.unit}
								</span>
							</div>
							{resolved?.stats.secondary && (
								<span
									className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									{resolved.stats.secondary}
								</span>
							)}
						</div>
						<div className="flex gap-1 shrink-0">
							{resolved?.stats.pills?.map((pill) => (
								<MetricPill
									key={pill.label}
									label={pill.label}
									value={pill.value}
									unit={pill.unit}
									format={(number) =>
										number.toFixed(pill.digits)
									}
								/>
							))}
						</div>
					</div>
				)
			) : card.layout === "centered" ? (
				<div className="relative flex justify-center items-center flex-1 z-10">
					<div
						className={
							value !== undefined
								? `text-xl font-bold bg-transparent px-2 rounded ${isDark ? "text-gray-100" : "text-gray-800"}`
								: `text-xs pt-0.5 ${isDark ? "text-gray-400" : "text-gray-400/80"}`
						}
					>
						{value !== undefined
							? formatValue(card, value)
							: "No data available"}
					</div>
				</div>
			) : (
				<ChartCardValueBar
					hasData={value !== undefined}
					value={value !== undefined ? formatValue(card, value) : "—"}
					unit={card.unit}
					secondary={resolved?.stats.secondary}
					barWidth={
						value !== undefined
							? Math.max(
									0,
									Math.min(100, (value / card.maximum) * 100),
								)
							: 0
					}
					barColor={color ?? undefined}
				/>
			)}
		</ChartCard>
	);
}
