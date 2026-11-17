"use client";

import { ChartCard } from "@/components/ChartCard";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { BreakdownBars } from "@/components/measures/BreakdownBars";
import { useIsDark } from "@/lib/context/ThemeContext";
import { breakdownView, type BreakdownPart } from "@/lib/measures/breakdown";
import type { MeasureValuesRequest } from "@/lib/measures/types";
import { useMeasureMembers } from "@/lib/measures/useMeasureMembers";

type Props = {
	/** The measure and the geography it is read at, without dimensions or areas. */
	request: Omit<MeasureValuesRequest, "periods" | "areas" | "dimensions">;
	/** The one area shown. */
	area: string | null;
	dimension: string;
	total: string;
	parts: readonly BreakdownPart[];
	/** The part whose colour highlights the card. */
	accent: string;
	heading: string;
	title?: string;
	coverage?: string;
	/** A note for the card once it has data, such as that a ward shows its authority's figure. */
	estimateNote?: (hasData: boolean) => string | undefined;
	isActive: boolean;
	onClick: () => void;
};

/**
 * A card for any measure split by a dimension: one area's total drawn as a
 * bar of its parts. Which parts, their colours and the wording are the
 * caller's; every number and label comes from the measure's own rows.
 */
export function MeasureBreakdownCard({
	request,
	area,
	dimension,
	total,
	parts,
	accent,
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
		area ? { ...request, areas: [area] } : null,
		dimension,
		[total, ...parts.map((part) => part.code)],
	);
	const view =
		area && state.status === "ready"
			? breakdownView(state.payloads, area, dimension, total, parts)
			: null;
	const loading = state.status === "loading" || chartsLoading;
	const accentColor = parts.find((part) => part.code === accent)?.color;

	return (
		<ChartCard
			coverage={coverage}
			heading={heading}
			estimateNote={estimateNote?.(view !== null)}
			accent={view ? (accentColor ?? null) : null}
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${isActive ? "min-h-[150px]" : "min-h-[65px]"} block w-full text-left`}
			title={title}
			onClick={onClick}
		>
			{view ? (
				<BreakdownBars bars={view.shares} isActive={isActive} />
			) : (
				<div className="flex-1">
					{area && loading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							{area ? "No data available" : "Select an area"}
						</div>
					)}
				</div>
			)}
		</ChartCard>
	);
}
