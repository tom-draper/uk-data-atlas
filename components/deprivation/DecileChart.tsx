"use client";
import type { ReactNode } from "react";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { ChartCard } from "@/components/ChartCard";
import { useChartsLoading } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";

export const DECILE_COLORS = [
	"#15803d", // 1 - least deprived
	"#16a34a", // 2
	"#22c55e", // 3
	"#4ade80", // 4
	"#a3e635", // 5
	"#eab308", // 6
	"#f59e0b", // 7
	"#f97316", // 8
	"#ef4444", // 9
	"#dc2626", // 10 - most deprived
];

interface DecileChartProps {
	title: string;
	heading: string;
	region: string;
	decile: number | null;
	footer: ReactNode;
	hasData: boolean;
	isActive: boolean;
	onClick: () => void;
}

export default function DecileChart({
	title,
	heading,
	region,
	decile,
	footer,
	hasData,
	isActive,
	onClick,
}: DecileChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const showData = hasData && !chartsLoading;
	const displayDecile = decile ? 11 - decile : null;
	const decileColor = displayDecile
		? DECILE_COLORS[displayDecile - 1]
		: "#9ca3af";

	return (
		<ChartCard
			heading={heading}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					{region}
				</span>
			}
			accent={showData ? decileColor : null}
			isActive={isActive}
			title={title}
			onClick={onClick}
		>
			<ChartCardValueBar
				hasData={showData}
				value={displayDecile ?? ""}
				unit="decile"
				secondary={footer}
				barWidth={(displayDecile ?? 0) * 10}
				barColor={decileColor}
			/>
		</ChartCard>
	);
}
