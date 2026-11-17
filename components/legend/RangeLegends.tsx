"use client";

import { RangeControl } from "@/components/controls/RangeControl";
import type { DisplayMapView } from "@uk-data-atlas/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey } from "./types";

export interface RangeLegendControls {
	displayOptions: MapOptions;
	verticalThemeGradient: string;
	overlayOpacity: number;
	onRangeInput: (key: ColorRangeDatasetKey, min: number, max: number) => void;
	onRangeChangeEnd: (key: ColorRangeDatasetKey) => void;
}

const defaultFormatLabel = (value: number) => value.toFixed(0);

interface DynamicRangeLegendProps extends RangeLegendControls {
	datasetKey: ColorRangeDatasetKey;
	absoluteRange: { min: number; max: number };
	defaultRange: { min: number; max: number };
	/** A data-derived initial range, superseded once the visitor adjusts it. */
	currentRange?: { min: number; max: number };
	formatLabel?: (value: number) => string;
}

/** A colour-range legend whose handles update one map-option group. */
export function DynamicRangeLegend({
	datasetKey,
	absoluteRange,
	defaultRange,
	currentRange,
	formatLabel = defaultFormatLabel,
	displayOptions,
	verticalThemeGradient,
	overlayOpacity,
	onRangeInput,
	onRangeChangeEnd,
}: DynamicRangeLegendProps) {
	const currentMin =
		currentRange?.min ??
		displayOptions[datasetKey].colorRange?.min ??
		defaultRange.min;
	const currentMax =
		currentRange?.max ??
		displayOptions[datasetKey].colorRange?.max ??
		defaultRange.max;
	const labels = [
		formatLabel(currentMax),
		formatLabel((currentMax - currentMin) * 0.75 + currentMin),
		formatLabel((currentMax - currentMin) * 0.5 + currentMin),
		formatLabel((currentMax - currentMin) * 0.25 + currentMin),
		formatLabel(currentMin),
	];

	return (
		<RangeControl
			min={absoluteRange.min}
			max={absoluteRange.max}
			currentMin={currentMin}
			currentMax={currentMax}
			gradient={verticalThemeGradient}
			labels={labels}
			opacity={overlayOpacity}
			onRangeInput={(min, max) => onRangeInput(datasetKey, min, max)}
			onRangeChangeEnd={() => onRangeChangeEnd(datasetKey)}
		/>
	);
}

/** The colour range control of a declared map view. */
export function MapViewLegend({
	view,
	...controls
}: { view: DisplayMapView } & RangeLegendControls) {
	const key = view.optionsKey as ColorRangeDatasetKey;
	if (view.palette === "gender") {
		const { colorRange } = controls.displayOptions[key];
		const currentMin = colorRange?.min ?? view.colorRange.min;
		const currentMax = colorRange?.max ?? view.colorRange.max;
		return (
			<RangeControl
				min={view.legend.min}
				max={view.legend.max}
				currentMin={currentMin}
				currentMax={currentMax}
				gradient="linear-gradient(to top, rgba(255,105,180,0.8), rgba(240,240,240,0.8), rgba(70,130,180,0.8))"
				labels={[
					`M ${(currentMax * 100).toFixed(0)}%`,
					"0%",
					`F ${(Math.abs(currentMin) * 100).toFixed(0)}%`,
				]}
				opacity={controls.overlayOpacity}
				onRangeInput={(min, max) =>
					controls.onRangeInput(key, min, max)
				}
				onRangeChangeEnd={() => controls.onRangeChangeEnd(key)}
			/>
		);
	}
	return (
		<DynamicRangeLegend
			{...controls}
			datasetKey={key}
			absoluteRange={view.legend}
			defaultRange={view.colorRange}
		/>
	);
}

export function BrexitLegend({
	datasetKey: key,
	...controls
}: RangeLegendControls & {
	datasetKey: "brexit" | "brexit-constituency";
}) {
	const { displayOptions, overlayOpacity, onRangeInput, onRangeChangeEnd } =
		controls;
	const currentMin = displayOptions[key].colorRange?.min ?? 30;
	const currentMax = displayOptions[key].colorRange?.max ?? 70;
	return (
		<RangeControl
			min={0}
			max={100}
			currentMin={currentMin}
			currentMax={currentMax}
			gradient="linear-gradient(to top, rgb(30, 60, 180), rgb(240, 240, 240), rgb(180, 20, 20))"
			labels={[
				`${currentMax.toFixed(0)}% Leave`,
				`${(100 - currentMin).toFixed(0)}% Remain`,
			]}
			opacity={overlayOpacity}
			onRangeInput={(min, max) => onRangeInput(key, min, max)}
			onRangeChangeEnd={() => onRangeChangeEnd(key)}
		/>
	);
}
