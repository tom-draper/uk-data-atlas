"use client";

import {
	createContext,
	memo,
	useContext,
	useMemo,
	useState,
	type ComponentType,
} from "react";
import { useNearViewport } from "@/lib/hooks/useNearViewport";
import { prefetchBoundaryRelease } from "@/lib/data/boundaries/tiles";
import type { BoundaryType } from "@/lib/types";
import type { ChartComponentProps } from "./chartComponentTypes";

type ObserveCard = (element: Element) => (() => void) | undefined;

const ObserveCardContext = createContext<ObserveCard | null>(null);

/** The ref callback a chart card attaches so its chart knows if it is seen. */
export function useObserveCard() {
	return useContext(ObserveCardContext);
}

const PrefetchCardContext = createContext<(() => void) | null>(null);

/** Reads ahead what the map waits on when one of this chart's cards is picked. */
export function usePrefetchCard() {
	return useContext(PrefetchCardContext);
}

/**
 * The boundary releases this chart's datasets are drawn on: the chart's own
 * dataset when it names one, else those of its year.
 */
function releasesOf({
	availableDatasets,
	datasetId,
	year,
}: Pick<ChartComponentProps, "availableDatasets" | "datasetId" | "year">) {
	const releases = new Map<string, [BoundaryType, number]>();
	for (const dataset of Object.values(availableDatasets ?? {}) as {
		id?: string;
		year?: number;
		boundaryType?: BoundaryType;
		boundaryYear?: number;
	}[]) {
		if (datasetId ? dataset.id !== datasetId : dataset.year !== year)
			continue;
		const { boundaryType, boundaryYear } = dataset;
		if (boundaryType && boundaryYear !== undefined)
			releases.set(`${boundaryType}/${boundaryYear}`, [
				boundaryType,
				boundaryYear,
			]);
	}
	return [...releases.values()];
}

type ChartComponent = ComponentType<ChartComponentProps>;

// Memoised once per chart type, so a chart whose area is held re-renders only
// when one of its other props changes.
const memoisedCharts = new WeakMap<ChartComponent, ChartComponent>();

function memoised(Chart: ChartComponent): ChartComponent {
	let memoisedChart = memoisedCharts.get(Chart);
	if (!memoisedChart) {
		memoisedChart = memo(Chart);
		memoisedCharts.set(Chart, memoisedChart);
	}
	return memoisedChart;
}

/**
 * Renders a chart that holds the area it last showed while all of its cards
 * are scrolled well out of view, so a hover re-renders only the charts that
 * can be seen. It catches up as one of its cards nears the viewport.
 */
export function ViewportGatedChart({
	Chart,
	selectedArea,
	...props
}: ChartComponentProps & { Chart: ChartComponent }) {
	const [observeCard, isNearViewport] = useNearViewport();
	const [shownArea, setShownArea] = useState(selectedArea);
	if (isNearViewport && shownArea !== selectedArea)
		setShownArea(selectedArea);
	const GatedChart = memoised(Chart);
	const { availableDatasets, datasetId, year } = props;
	const prefetch = useMemo(() => {
		const releases = releasesOf({ availableDatasets, datasetId, year });
		return () => {
			for (const [type, boundaryYear] of releases)
				prefetchBoundaryRelease(type, boundaryYear);
		};
	}, [availableDatasets, datasetId, year]);

	return (
		<ObserveCardContext value={observeCard}>
			<PrefetchCardContext value={prefetch}>
				<GatedChart {...props} selectedArea={shownArea} />
			</PrefetchCardContext>
		</ObserveCardContext>
	);
}
