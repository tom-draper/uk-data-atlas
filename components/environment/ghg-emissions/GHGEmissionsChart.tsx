"use client";
import {
	ActiveViz,
	AggregatedGhgEmissionsData,
	Dataset,
	GhgEmissionsDataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartDataPlaceholder } from "@/components/ChartDataPlaceholder";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { localAuthorityStats } from "@/lib/helpers/localAuthorityStats";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";

interface GHGEmissionsChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GhgEmissionsDataset>;
	aggregatedData: Record<number, AggregatedGhgEmissionsData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#0ea5e9";

const MEASURES = {
	perPerson: {
		key: "perPersonTCO2e",
		label: "per person",
		format: (value: number) => value.toFixed(1),
		unit: "t CO₂e per person",
	},
	total: {
		key: "totalKtCO2e",
		label: "total",
		format: (value: number) => (value / 1000).toFixed(1),
		unit: "Mt CO₂e total",
	},
	excludingLandUse: {
		key: "excludingLandUseKtCO2e",
		label: "excluding land use",
		format: (value: number) => (value / 1000).toFixed(1),
		unit: "Mt CO₂e excl. land use",
	},
} as const;

// The UK average is a little over 5 tonnes a head, so the bands sit either
// side of it rather than at round numbers.
function perPersonColor(tonnes: number): string {
	if (tonnes < 4) return "#22c55e";
	if (tonnes < 6) return "#eab308";
	if (tonnes < 9) return "#f97316";
	return "#ef4444";
}

function SectorBar({
	label,
	value,
	total,
	isDark,
}: {
	label: string;
	value: number;
	total: number;
	isDark: boolean;
}) {
	const share = total > 0 ? (value / total) * 100 : 0;
	return (
		<div className="flex flex-col items-center gap-0.5 w-8">
			<div
				className={`w-full h-6 rounded-sm flex items-end overflow-hidden ${isDark ? "bg-white/5" : "bg-black/5"}`}
			>
				<div
					className="w-full rounded-sm"
					style={{
						height: `${Math.min(100, share)}%`,
						backgroundColor: ACCENT,
					}}
				/>
			</div>
			<span
				className={`text-[9px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
			>
				{label}
			</span>
		</div>
	);
}

export default function GHGEmissionsChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: GHGEmissionsChartProps) {
	const isDark = useIsDark();
	const measure = useCurrentMapOptions().ghgEmissions.measure;
	const measureInfo = MEASURES[measure];
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? localAuthorityStats(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
				(record) => ({
					totalKtCO2e: record.totalKtCO2e,
					excludingLandUseKtCO2e: record.excludingLandUseKtCO2e,
					perPersonTCO2e: record.perPersonTCO2e,
					transport: record.transport,
					domestic: record.domestic,
					industry: record.industry,
				}),
			)
		: null;

	const isActive =
		activeDataset?.type === "ghgEmissions" &&
		activeDataset.id === dataset?.id;

	if (!dataset) return null;

	const value = stats?.[measureInfo.key] ?? null;
	const color =
		value != null && measure === "perPerson"
			? perPersonColor(value)
			: value != null
				? ACCENT
				: null;
	const sectorTotal = stats?.excludingLandUseKtCO2e ?? 0;

	return (
		<ChartCard
			heading={`Greenhouse Gas Emissions, ${measureInfo.label} [${dataset.year}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, stats !== null)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={stats ? ACCENT : null}
			isActive={isActive}
			title="DESNZ. UK local authority greenhouse gas emissions. gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!stats ? (
				<ChartDataPlaceholder />
			) : (
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className="flex flex-col gap-0.5">
						<div className="flex items-baseline gap-1">
							<span
								className="text-2xl font-bold leading-none"
								style={{ color: color ?? undefined }}
							>
								{value != null
									? measureInfo.format(value)
									: "—"}
							</span>
							<span
								className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								{measureInfo.unit}
							</span>
						</div>
						<span
							className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{measure === "perPerson"
								? `${(stats.totalKtCO2e / 1000).toFixed(1)} Mt total`
								: `${stats.perPersonTCO2e.toFixed(1)} t per person`}
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<SectorBar
							label="Trans"
							value={stats.transport}
							total={sectorTotal}
							isDark={isDark}
						/>
						<SectorBar
							label="Dom"
							value={stats.domestic}
							total={sectorTotal}
							isDark={isDark}
						/>
						<SectorBar
							label="Ind"
							value={stats.industry}
							total={sectorTotal}
							isDark={isDark}
						/>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
