"use client";

import {
	createContext,
	memo,
	useContext,
	useState,
	type ComponentType,
} from "react";
import { useNearViewport } from "@/lib/hooks/useNearViewport";
import type { ChartComponentProps } from "./chartComponentTypes";

type ObserveCard = (element: Element) => (() => void) | undefined;

const ObserveCardContext = createContext<ObserveCard | null>(null);

/** The ref callback a chart card attaches so its chart knows if it is seen. */
export function useObserveCard() {
	return useContext(ObserveCardContext);
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

	return (
		<ObserveCardContext value={observeCard}>
			<GatedChart {...props} selectedArea={shownArea} />
		</ObserveCardContext>
	);
}
