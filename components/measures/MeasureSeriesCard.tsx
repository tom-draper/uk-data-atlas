"use client";

import type { ReactNode } from "react";
import { ChartCard } from "@/components/ChartCard";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import { useIsDark } from "@/lib/context/ThemeContext";
import { areaSeries } from "@/lib/measures/client";
import { formatMeasureValue } from "@/lib/measures/presentation";
import { latestPoint, numericPoints, sparkline } from "@/lib/measures/series";
import type {
	MeasureValuesPayload,
	MeasureValuesRequest,
} from "@/lib/measures/types";
import { useMeasureSeries } from "@/lib/measures/useMeasureSeries";

type SeriesView = {
	/** The latest value as text, with the period it is for. */
	value: string;
	period: string;
	line: ReturnType<typeof sparkline>;
};

/** What a card shows of one area's history, or null if it has no values. */
export function seriesView(
	payload: MeasureValuesPayload,
	area: string,
): SeriesView | null {
	const points = areaSeries(payload, area);
	const latest = latestPoint(points);
	if (!latest) return null;
	return {
		value: formatMeasureValue(
			payload.measure.valueKind,
			payload.measure.unit,
			latest.value,
		),
		period: latest.period,
		line: sparkline(
			numericPoints(points).map((point) => point.value),
			{
				margin: 0,
				padY: 12,
			},
		),
	};
}

type Props = {
	/** The measure, the geography it is read at, and the one area shown. */
	request: Omit<MeasureValuesRequest, "periods" | "areas">;
	area: string | null;
	heading: string;
	color: string;
	title?: string;
	coverage?: string;
	estimateNote?: string;
	isActive: boolean;
	onClick: () => void;
	/** Shown where the card has nothing to say, such as before an area is chosen. */
	empty?: ReactNode;
};

/**
 * A card for any measure with a history: its latest value for one area over a
 * line of the periods before it. Everything it says comes from the measure's
 * own metadata and rows, so a new measure needs no card of its own.
 */
export function MeasureSeriesCard({
	request,
	area,
	heading,
	color,
	title,
	coverage,
	estimateNote,
	isActive,
	onClick,
	empty,
}: Props) {
	const isDark = useIsDark();
	const chartsLoading = useChartsLoading();
	const state = useMeasureSeries(area ? { ...request, areas: [area] } : null);
	const view =
		area && state.status === "ready" ? seriesView(state.data, area) : null;
	const loading = state.status === "loading" || chartsLoading;

	return (
		<ChartCard
			heading={heading}
			accent={view ? color : null}
			isActive={isActive}
			onClick={onClick}
			title={title}
			coverage={coverage}
			estimateNote={estimateNote}
			background={
				view?.line && (
					<SparklineBackground
						sparkline={view.line}
						color={color}
						gradientId={`series-${request.measure}`}
						fade={[
							{ offset: "0%", opacity: isDark ? 0.2 : 0.12 },
							{ offset: "80%", opacity: 0 },
						]}
						strokeWidth={1.5}
						marker
					/>
				)
			}
		>
			{view ? (
				<div className="relative z-10 flex items-end justify-between gap-1.5 flex-1">
					<div
						className={`text-2xl font-bold leading-none ${isDark ? "text-gray-100" : "text-gray-800"}`}
					>
						{view.value}
						<span
							className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							({view.period})
						</span>
					</div>
				</div>
			) : (
				<div className="flex-1 mt-1">
					{area && loading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							{area
								? "No data available"
								: (empty ?? "Select an area")}
						</div>
					)}
				</div>
			)}
		</ChartCard>
	);
}
