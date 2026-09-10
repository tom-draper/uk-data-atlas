"use client";

import { RangeControl } from "@/components/controls/RangeControl";
import type { ActiveViz } from "@/lib/types";
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
	formatLabel?: (value: number) => string;
}

/** A colour-range legend whose handles update one map-option group. */
export function DynamicRangeLegend({
	datasetKey,
	absoluteRange,
	defaultRange,
	formatLabel = defaultFormatLabel,
	displayOptions,
	verticalThemeGradient,
	overlayOpacity,
	onRangeInput,
	onRangeChangeEnd,
}: DynamicRangeLegendProps) {
	const currentMin =
		displayOptions[datasetKey].colorRange?.min ?? defaultRange.min;
	const currentMax =
		displayOptions[datasetKey].colorRange?.max ?? defaultRange.max;
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

export function PopulationLegend({
	activeViz,
	...controls
}: { activeViz: ActiveViz } & RangeLegendControls) {
	if (activeViz.view === "age") {
		return (
			<DynamicRangeLegend
				{...controls}
				datasetKey="ageDistribution"
				absoluteRange={{ min: 18, max: 80 }}
				defaultRange={{ min: 25, max: 55 }}
			/>
		);
	}
	if (activeViz.view === "gender") {
		const currentMin =
			controls.displayOptions.gender?.colorRange?.min ?? -0.1;
		const currentMax =
			controls.displayOptions.gender?.colorRange?.max ?? 0.1;
		return (
			<RangeControl
				min={-0.5}
				max={0.5}
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
					controls.onRangeInput("gender", min, max)
				}
				onRangeChangeEnd={() => controls.onRangeChangeEnd("gender")}
			/>
		);
	}

	// A link that names no view gets the dataset's primary chart, density.
	return (
		<DynamicRangeLegend
			{...controls}
			datasetKey="populationDensity"
			absoluteRange={{ min: 0, max: 15000 }}
			defaultRange={{ min: 500, max: 8000 }}
		/>
	);
}

export function BrexitLegend({
	datasetKey: key,
	...controls
}: RangeLegendControls & {
	datasetKey: "brexit" | "brexitConstituency";
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
