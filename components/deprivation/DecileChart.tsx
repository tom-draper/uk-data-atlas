"use client";
import type { ReactNode } from "react";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

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
	extraClassName?: string;
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
	extraClassName,
	onClick,
}: DecileChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const showData = hasData && !chartsLoading;
	const displayDecile = decile ? 11 - decile : null;
	const decileColor = displayDecile ? DECILE_COLORS[displayDecile - 1] : "#9ca3af";

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		showData ? decileColor : null,
		isActive,
		isDark,
	);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, `h-[72px]${extraClassName ? ` ${extraClassName}` : ""}`)}
			title={title}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={onClick}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex flex-col flex-1">
				<div className="flex items-start justify-between mb-1.5 shrink-0">
					<h3 className={chartHeadingClass(isDark)}>{heading}</h3>
					<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{region}</span>
				</div>
				{showData ? (
					<div className="flex items-start gap-2.5">
						<div className="shrink-0 w-8 text-right leading-none mt-[-2px]">
							<span
								className="text-3xl font-bold leading-none"
								style={{ color: decileColor }}
							>
								{displayDecile}
							</span>
						</div>
						<div className="flex-1 flex flex-col gap-1.5">
							<div className="flex gap-[2px]">
								{DECILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-3 rounded-[2px]"
										style={{
											backgroundColor:
												displayDecile === i + 1
													? color
													: isDark
														? "rgba(255,255,255,0.1)"
														: "rgba(0,0,0,0.08)",
										}}
									/>
								))}
							</div>
							<div className="flex justify-between">
								<span className={`text-[9px] leading-none ${isDark ? "text-gray-500" : "text-gray-400"}`}>least deprived</span>
								{footer}
							</div>
						</div>
					</div>
				) : (
					<div className="flex-1">
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
				)}
			</div>
		</button>
	);
}
