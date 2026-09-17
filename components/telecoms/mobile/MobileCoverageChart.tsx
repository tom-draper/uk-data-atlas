"use client";
import {
	ActiveViz,
	AggregatedMobileCoverageData,
	Dataset,
	MobileCoverageDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

interface MobileCoverageChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, MobileCoverageDataset>;
	aggregatedData: Record<number, AggregatedMobileCoverageData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#8b5cf6";

// Half the country sits below a third of premises on all four networks, so the
// bands are set against that spread rather than against 100%.
function coverageColor(share: number): string {
	if (share >= 75) return "#22c55e";
	if (share >= 40) return "#eab308";
	if (share >= 10) return "#f97316";
	return "#ef4444";
}

function StatPill({
	label,
	value,
	isDark,
}: {
	label: string;
	value: number | null;
	isDark: boolean;
}) {
	return (
		<div
			className={`flex flex-col items-center px-2 py-1 rounded ${isDark ? "bg-white/5" : "bg-black/5"}`}
		>
			<span
				className={`text-[9px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}
			>
				{label}
			</span>
			<span
				className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				{value != null ? `${value.toFixed(1)}` : "—"}
				{value != null && (
					<span className="text-[9px] font-normal ml-0.5">%</span>
				)}
			</span>
		</div>
	);
}

function computeStats(
	dataset: MobileCoverageDataset,
	aggregatedData: Record<number, AggregatedMobileCoverageData> | null,
	selectedArea: SelectedArea | null,
): AggregatedMobileCoverageData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const record = dataset.data[code];
		if (!record) return null;
		return {
			pct4GIndoorAll: record.pct4GIndoorAll,
			pct4GIndoorAny: record.pct4GIndoorAny,
			pct5GOutdoorAll: record.pct5GOutdoorAll,
			pct5GOutdoorAny: record.pct5GOutdoorAny,
			pct4GGeoAll: record.pct4GGeoAll,
			pct5GGeoAny: record.pct5GGeoAny,
		};
	};

	if (selectedArea.type === "localAuthority")
		return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode)
		return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function MobileCoverageChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: MobileCoverageChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea)
		: null;

	const isActive =
		activeDataset?.type === "mobileCoverage" &&
		activeDataset.id === dataset?.id;

	if (!dataset) return null;

	const fiveG = stats?.pct5GOutdoorAll ?? null;
	const color = fiveG != null ? coverageColor(fiveG) : null;

	return (
		<ChartCard
			heading={`Mobile Coverage [${dataset.year}]`}
			accent={stats ? ACCENT : null}
			isActive={isActive}
			title="Ofcom. Connected Nations, mobile coverage. ofcom.org.uk"
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
								{fiveG != null ? fiveG.toFixed(1) : "—"}
							</span>
							<span
								className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								% 5G, all four
							</span>
						</div>
						<span
							className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{stats.pct5GOutdoorAny != null
								? `${stats.pct5GOutdoorAny.toFixed(1)}% on at least one`
								: "—"}
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<StatPill
							label="4G in"
							value={stats.pct4GIndoorAll}
							isDark={isDark}
						/>
						<StatPill
							label="4G land"
							value={stats.pct4GGeoAll}
							isDark={isDark}
						/>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
