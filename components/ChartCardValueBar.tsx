"use client";

import type { ReactNode } from "react";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";

interface ChartCardValueBarProps {
	hasData: boolean;
	value: ReactNode;
	unit: ReactNode;
	barWidth: number;
	barColor?: string;
	secondary?: ReactNode;
}

export function ChartCardValueBar({
	hasData,
	value,
	unit,
	barWidth,
	barColor,
	secondary,
}: ChartCardValueBarProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	if (!hasData) {
		return (
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
		);
	}

	return (
		<div className="flex-1 flex flex-col gap-1">
			<div className="flex items-baseline justify-between">
				<div className="leading-none">
					<span
						className="text-2xl font-bold leading-none"
						style={{ color: barColor }}
					>
						{value}
					</span>
					<span
						className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
					>
						{unit}
					</span>
				</div>
				{secondary && (
					<span
						className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
					>
						{secondary}
					</span>
				)}
			</div>
			<div
				className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}
			>
				<div
					className="h-full rounded-xs transition-all duration-300"
					style={{ width: `${barWidth}%`, backgroundColor: barColor }}
				/>
			</div>
		</div>
	);
}
