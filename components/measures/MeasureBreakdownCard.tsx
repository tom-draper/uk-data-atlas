"use client";

import { ChartCard } from "@/components/ChartCard";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { BreakdownBars } from "@/components/measures/BreakdownBars";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	breakdownView,
	type BreakdownOptions,
	type BreakdownPart,
} from "@/lib/measures/breakdown";
import type { MeasureValuesRequest } from "@/lib/measures/types";
import { requestAreas } from "@/lib/measures/scope";
import { useMeasureMembers } from "@/lib/measures/useMeasureMembers";

type Props = {
	/** The measure and the geography it is read at, without dimensions or areas. */
	request: Omit<MeasureValuesRequest, "periods" | "areas" | "dimensions">;
	/** The areas the figure covers, or null until they are known. */
	scope: readonly string[] | null;
	/** The area hovered or selected; the whole scope when none is. */
	area: string | null;
	dimension: string;
	/** The member that is the total; absent, the sum of the parts. */
	total?: string;
	parts: readonly BreakdownPart[];
	/** The part whose colour highlights the card; absent, the largest drawn. */
	accent?: string;
	/** Which parts are drawn, and in what order. */
	options?: BreakdownOptions;
	heading: string;
	title?: string;
	coverage?: string;
	/** A note for the card once it has data, such as that a ward shows its authority's figure. */
	estimateNote?: (hasData: boolean) => string | undefined;
	isActive: boolean;
	onClick: () => void;
};

/**
 * A card for any measure split by a dimension: a total drawn as a bar of its
 * parts, for the selected area or, before one is chosen, for every area in
 * scope. Which parts, their colours and the wording are the caller's; every
 * number and label comes from the measure's own rows.
 */
export function MeasureBreakdownCard({
	request,
	scope,
	area,
	dimension,
	total,
	parts,
	accent,
	options,
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
		total === undefined
			? parts.map((part) => part.code)
			: [total, ...parts.map((part) => part.code)],
	);
	const view =
		state.status === "ready"
			? breakdownView(
					state.payloads,
					area,
					dimension,
					total,
					parts,
					options,
				)
			: null;
	const loading =
		state.status === "loading" || chartsLoading || scope === null;
	const accentColor =
		accent === undefined
			? view?.shares.reduce((most, share) =>
					share.pct > most.pct ? share : most,
				).color
			: parts.find((part) => part.code === accent)?.color;

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
