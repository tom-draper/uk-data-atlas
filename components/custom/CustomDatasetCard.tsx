import { useMemo } from "react";
import { ActiveViz, BoundaryType, CustomDataset } from "@/lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { getCustomDatasetDisplayValue } from "@/lib/data/custom/displayValue";
import type { SelectedCustomArea } from "./types";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useAggregatedDataset } from "@/lib/hooks/useAggregatedDataset";
import { getColor } from "@/lib/helpers/colorScale/themes";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

export function CustomDatasetCard({
	customDataset,
	selectedArea,
	isActive,
	setActiveViz,
	codeMapper,
	mapManager,
	boundaryData,
	location,
}: {
	customDataset: CustomDataset;
	selectedArea: SelectedCustomArea | null;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const customDatasets = useMemo(
		() => ({ [customDataset.year]: customDataset }),
		[customDataset],
	);
	const aggregatedData = useAggregatedDataset(
		{
			datasets: customDatasets,
			boundaryType: customDataset.boundaryType,
			calculateStats: (mm, g, d, loc, id) =>
				mm.calculateCustomDatasetStats(g, d, loc, id),
		},
		mapManager,
		boundaryData,
		location,
	);
	const displayValue = getCustomDatasetDisplayValue(
		customDataset,
		selectedArea,
		codeMapper,
		aggregatedData,
	);

	const handleActivate = () => {
		setActiveViz({
			datasetId: customDataset.id,
			datasetType: "custom",
			datasetYear: customDataset.boundaryYear,
		});
	};

	if (!customDataset) return null;

	const allValues = Object.values(customDataset.data);
	const dataMin = allValues.length ? Math.min(...allValues) : 0;
	const dataMax = allValues.length ? Math.max(...allValues) : 100;
	const range = dataMax - dataMin || 1;

	const barWidth = displayValue
		? Math.max(0, Math.min(((displayValue.value - dataMin) / range) * 100, 100))
		: 0;
	const valueColor = displayValue ? getColor(barWidth / 100) : "#6366f1";

	const hasData = displayValue !== null;

	if (customDataset.kind === "points") {
		const pts = customDataset.points ?? [];
		return (
			<ChartCard
				heading={customDataset.dataColumn}
				accent={displayValue ? valueColor : null}
				isActive={isActive}
				onClick={handleActivate}
			>
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline gap-2">
						<span
							className="text-2xl font-bold leading-none"
							style={{ color: "#6366f1" }}
						>
							{pts.length.toLocaleString("en-GB")}
						</span>
						<span
							className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							points
						</span>
					</div>
					{pts.length > 0 && (
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							{customDataset.valueMin?.toLocaleString("en-GB")} –{" "}
							{customDataset.valueMax?.toLocaleString("en-GB")}
						</span>
					)}
				</div>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			heading={`${customDataset.dataColumn} [${customDataset.boundaryYear}]`}
			accent={displayValue ? valueColor : null}
			isActive={isActive}
			onClick={handleActivate}
		>
			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span className="text-2xl font-bold leading-none" style={{ color: valueColor }}>
								{displayValue!.value.toLocaleString("en-GB", {
									minimumFractionDigits: 0,
									maximumFractionDigits: 2,
								})}
							</span>
						</div>
						<span className={`text-[9px] ${displayValue!.count > 1 ? "" : "invisible"} ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							{displayValue!.count} wards avg
						</span>
					</div>
					<div className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}>
						<div
							className="h-full rounded-xs transition-all duration-300"
							style={{ width: `${barWidth}%`, backgroundColor: valueColor }}
						/>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
