"use client";

import { ChartCard } from "@/components/ChartCard";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { barsView, rampColor } from "@/lib/measures/bars";
import type { BarsCardConfig } from "@/lib/measures/barsConfig";
import { requestAreas } from "@/lib/measures/scope";
import type { MeasureValuesRequest } from "@/lib/measures/types";
import { useMeasureMembers } from "@/lib/measures/useMeasureMembers";

type Props = Pick<BarsCardConfig, "dimension" | "bars" | "combine" | "ramp"> & {
	/** The measure and the geography it is read at, without dimensions or areas. */
	request: Omit<MeasureValuesRequest, "periods" | "areas" | "dimensions">;
	/** The areas the figures cover, or null until they are known. */
	scope: readonly string[] | null;
	/** The area hovered or selected; the whole scope when none is. */
	area: string | null;
	digits: number;
	heading: string;
	title?: string;
	coverage?: string;
	estimateNote?: (hasData: boolean) => string | undefined;
	isActive: boolean;
	onClick: () => void;
};

/**
 * A card for any measure split by a dimension whose members are drawn as
 * bars on one scale. The scale runs from the lowest to the highest value of
 * any area in scope, so it follows the measure in use and the places the map
 * is filtered to.
 */
export function MeasureBarsCard({
	request,
	scope,
	area,
	dimension,
	bars,
	combine,
	ramp,
	digits,
	heading,
	title,
	coverage,
	estimateNote,
	isActive,
	onClick,
}: Props) {
	const isDark = useIsDark();
	const chartsLoading = useChartsLoading();
	const state = useMeasureMembers(
		scope?.length ? { ...request, areas: requestAreas(scope) } : null,
		dimension,
		bars.map((bar) => bar.code),
	);
	const view =
		state.status === "ready"
			? barsView(state.payloads, area, { bars, combine })
			: null;
	const loading =
		state.status === "loading" || chartsLoading || scope === null;

	return (
		<ChartCard
			coverage={coverage}
			heading={heading}
			estimateNote={estimateNote?.(view !== null)}
			headerClassName="mb-0"
			accent={view ? rampColor(ramp, view.meanPct).hex : null}
			isActive={isActive}
			minHeightClassName="min-h-[72px]"
			title={title}
			onClick={onClick}
		>
			{view ? (
				<div className="mt-1 space-y-0">
					{view.bars.map((bar) => {
						const { r, g, b } = rampColor(ramp, bar.pct);
						return (
							<div
								key={bar.key}
								className="flex items-center gap-1.5"
							>
								<span
									className={`text-[10px] w-3 ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
								>
									{bar.label}
								</span>
								<div
									className={`flex-1 h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}
								>
									<div
										className="h-full rounded-xs"
										style={{
											width: `${bar.pct}%`,
											backgroundColor: `rgba(${r}, ${g}, ${b}, 0.85)`,
										}}
									/>
								</div>
								<span
									className={`text-[10px] font-semibold w-8 text-right ${isDark ? "text-gray-300" : "text-gray-600"}`}
								>
									{bar.value.toFixed(digits)}
								</span>
							</div>
						);
					})}
				</div>
			) : (
				<div className="flex-1 mt-1">
					{loading ? (
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
		</ChartCard>
	);
}
