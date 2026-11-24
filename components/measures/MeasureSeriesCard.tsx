"use client";

import { ChartCard } from "@/components/ChartCard";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ratioSeries, readSeries } from "@/lib/measures/combine";
import {
	type EarlierArea,
	type EarlierPayload,
	useEarlierSeries,
	withEarlierPeriods,
} from "@/lib/measures/earlier";
import { formatMeasureValue } from "@/lib/measures/presentation";
import { requestAreas } from "@/lib/measures/scope";
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
	/** Where each break falls across the line, from 0 to 100. */
	breaks: number[];
};

/**
 * Where each break falls across a line through these periods, from 0 to 100:
 * halfway between the last period before it and the first from it. A break
 * outside the line, or at its first point, is not drawn.
 */
export function breakPositions(
	periods: readonly string[],
	breaks: ReadonlyArray<{ period: string }>,
): number[] {
	if (periods.length < 2) return [];
	return breaks.flatMap(({ period }) => {
		const at = periods.findIndex((p) => p >= period);
		return at > 0 ? [((at - 0.5) / (periods.length - 1)) * 100] : [];
	});
}

/**
 * What a card shows of one area's history, or, with no area, of every area
 * in the response together. A rate with the counts it is of combines by their
 * implied base; a measure that adds up is summed. An area's periods under
 * earlier codes fill those before its own. Null if there are no values.
 */
export function seriesView(
	payload: MeasureValuesPayload,
	area: string | null,
	counts?: MeasureValuesPayload | null,
	combine?: "mean",
	breaks: ReadonlyArray<{ period: string }> = [],
	earlier: readonly EarlierPayload[] = [],
): SeriesView | null {
	const points =
		area === null && counts
			? ratioSeries(payload, counts)
			: area !== null && earlier.length
				? withEarlierPeriods(
						readSeries(payload, area, combine),
						earlier.map((e) =>
							readSeries(e.payload, e.area, combine),
						),
					)
				: readSeries(payload, area, combine);
	const latest = latestPoint(points);
	if (!latest) return null;
	const drawn = numericPoints(points);
	return {
		value: formatMeasureValue(
			payload.measure.valueKind,
			payload.measure.unit,
			latest.value,
		),
		period: latest.period,
		line: sparkline(
			drawn.map((point) => point.value),
			{
				margin: 0,
				padY: 12,
			},
		),
		breaks: breakPositions(
			drawn.map((point) => point.period),
			breaks,
		),
	};
}

const NONE: readonly EarlierArea[] = [];

type Props = {
	/** The measure and the geography it is read at. */
	request: Omit<MeasureValuesRequest, "periods" | "areas">;
	/** The areas the figure covers, or null until they are known. */
	scope: readonly string[] | null;
	/** The area hovered or selected; the whole scope when none is. */
	area: string | null;
	/** For a rate, the measure of the people it counts, to combine areas. */
	countMeasure?: string;
	/** The member of each dimension of `countMeasure` to read, where not the default. */
	countDimensions?: Record<string, string[]>;
	/** The selected area's earlier codes and the releases that hold them. */
	earlier?: readonly EarlierArea[];
	/** Where the series breaks, marked on the line. */
	breaks?: ReadonlyArray<{ period: string }>;
	/** How areas combine before one is chosen; added up where absent. */
	combine?: "mean";
	heading: string;
	/** The card's highlight colour. */
	accent: string;
	/** The line's colour. */
	color: string;
	title?: string;
	coverage?: string;
	/** A note for the card once it has data, such as that a ward shows its authority's figure. */
	estimateNote?: (hasData: boolean) => string | undefined;
	isActive: boolean;
	onClick: () => void;
};

/**
 * A card for any measure with a history: its latest value over a line of the
 * periods before it, for the selected area or, before one is chosen, for every
 * area in scope. Everything it says comes from the measure's
 * own metadata and rows, so a new measure needs no card of its own.
 */
export function MeasureSeriesCard({
	request,
	scope,
	area,
	countMeasure,
	countDimensions,
	earlier = NONE,
	breaks,
	combine,
	heading,
	accent,
	color,
	title,
	coverage,
	estimateNote,
	isActive,
	onClick,
}: Props) {
	const isDark = useIsDark();
	const chartsLoading = useChartsLoading();
	const scoped = scope?.length
		? { ...request, areas: requestAreas(scope) }
		: null;
	const state = useMeasureSeries(scoped);
	const counts = useMeasureSeries(
		scoped && countMeasure
			? {
					...scoped,
					measure: countMeasure,
					dimensions: countDimensions,
				}
			: null,
	);
	const before = useEarlierSeries(request, area === null ? NONE : earlier);
	// A rate shown for every area needs the counts it is of, so waits for them.
	const waitingOnCounts = !area && countMeasure && counts.status !== "ready";
	const waitingOnEarlier = before.status === "loading";
	const view =
		state.status === "ready" && !waitingOnCounts && !waitingOnEarlier
			? seriesView(
					state.data,
					area,
					counts.status === "ready" ? counts.data : null,
					combine,
					breaks,
					before.status === "ready" ? before.value : [],
				)
			: null;
	const loading =
		state.status === "loading" ||
		counts.status === "loading" ||
		waitingOnEarlier ||
		chartsLoading ||
		scope === null;

	return (
		<ChartCard
			heading={heading}
			accent={view ? accent : null}
			isActive={isActive}
			onClick={onClick}
			title={title}
			coverage={coverage}
			estimateNote={estimateNote?.(view !== null)}
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
						breaks={view.breaks}
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
