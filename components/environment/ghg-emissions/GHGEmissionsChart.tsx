"use client";
import {
	ActiveViz,
	AggregatedGhgEmissionsData,
	Dataset,
	GhgEmissionsDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

interface GHGEmissionsChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GhgEmissionsDataset>;
	aggregatedData: Record<number, AggregatedGhgEmissionsData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#0ea5e9";

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

function computeStats(
	dataset: GhgEmissionsDataset,
	aggregatedData: Record<number, AggregatedGhgEmissionsData> | null,
	selectedArea: SelectedArea | null,
): AggregatedGhgEmissionsData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const record = dataset.data[code];
		if (!record) return null;
		return {
			totalKtCO2e: record.totalKtCO2e,
			excludingLandUseKtCO2e: record.excludingLandUseKtCO2e,
			perPersonTCO2e: record.perPersonTCO2e,
			transport: record.transport,
			domestic: record.domestic,
			industry: record.industry,
		};
	};

	if (selectedArea.type === "localAuthority")
		return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode)
		return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function GHGEmissionsChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: GHGEmissionsChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea)
		: null;

	const isActive =
		activeDataset?.type === "ghgEmissions" &&
		activeDataset.id === dataset?.id;

	if (!dataset) return null;

	const perPerson = stats?.perPersonTCO2e ?? null;
	const color = perPerson != null ? perPersonColor(perPerson) : null;
	const sectorTotal = stats?.excludingLandUseKtCO2e ?? 0;

	return (
		<ChartCard
			heading={`Greenhouse Gas Emissions [${dataset.year}]`}
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
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className="flex flex-col gap-0.5">
						<div className="flex items-baseline gap-1">
							<span
								className="text-2xl font-bold leading-none"
								style={{ color: color ?? undefined }}
							>
								{perPerson != null ? perPerson.toFixed(1) : "—"}
							</span>
							<span
								className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								t CO₂e per person
							</span>
						</div>
						<span
							className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{(stats.totalKtCO2e / 1000).toFixed(1)} Mt total
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
