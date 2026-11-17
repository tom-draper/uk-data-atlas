"use client";

import { useIsDark } from "@/lib/context/ThemeContext";
import { formatCount } from "@/lib/helpers/formatCount";

export type BreakdownBar = {
	key: string;
	label: string;
	color: string;
	count: number;
	pct: number;
};

/** A total split into its parts as one bar, with a key once the card opens. */
export function BreakdownBars({
	bars,
	isActive,
}: {
	bars: readonly BreakdownBar[];
	isActive: boolean;
}) {
	const isDark = useIsDark();
	return (
		<div className="space-y-1">
			<div className="flex h-5 rounded overflow-hidden w-full gap-0">
				{bars.map(({ key, label, color, pct, count }) => (
					<div
						key={key}
						style={{
							width: `${pct}%`,
							backgroundColor: color,
						}}
						title={`${label}: ${formatCount(count)} (${pct.toFixed(1)}%)`}
						className="hover:opacity-80 transition-opacity"
					>
						{pct > 8 && (
							<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
								{pct.toFixed(0)}%
							</span>
						)}
					</div>
				))}
			</div>

			{isActive && (
				<div className="animate-in fade-in duration-200 mt-1">
					<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
						{bars.map(({ key, label, color, pct }) => (
							<div
								key={key}
								className="flex items-center gap-1 min-w-0"
							>
								<div
									className="size-1.5 rounded-sm shrink-0"
									style={{ backgroundColor: color }}
								/>
								<span
									className={`text-[9px] truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}
									title={label}
								>
									{pct.toFixed(1)}% {label}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
