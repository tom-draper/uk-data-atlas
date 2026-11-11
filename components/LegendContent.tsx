"use client";

import type { ActiveViz, Dataset } from "@/lib/types";
import { getChartDatasetDefinition } from "@/lib/datasets";
import { declaredMeasure, formatDisplay } from "@/lib/datasets/declared";
import {
	EthnicityLegend,
	NetworkLegend,
	PartyLegend,
} from "./legend/CategoryLegends";
import { CustomLegend } from "./legend/CustomLegend";
import {
	BrexitLegend,
	DynamicRangeLegend,
	PopulationLegend,
} from "./legend/RangeLegends";
import type {
	ColorRangeDatasetKey,
	EthnicityDisplayData,
	PartyDisplayData,
} from "./legend/types";
import type { MapOptions } from "@/lib/types/mapOptions";

interface LegendContentProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	displayOptions: MapOptions;
	verticalThemeGradient: string;
	overlayOpacity: number;
	isDark: boolean;
	parties: PartyDisplayData[];
	ethnicities: EthnicityDisplayData[];
	onRangeInput: (key: ColorRangeDatasetKey, min: number, max: number) => void;
	onRangeChangeEnd: (key: ColorRangeDatasetKey) => void;
	onPartyClick: (id: string) => void;
	onPartyRightClick: (id: string) => void;
	onEthnicityClick: (id: string) => void;
	onEthnicityRightClick: (id: string) => void;
	onPointLegendClick: (value: string) => void;
	onPointLegendRightClick: (value: string) => void;
	onNetworkClick: (id: string) => void;
	onNetworkRightClick: (id: string) => void;
}

/** Routes each dataset to the legend renderer that owns its display model. */
export default function LegendContent({
	activeDataset,
	activeViz,
	displayOptions,
	verticalThemeGradient,
	overlayOpacity,
	isDark,
	parties,
	ethnicities,
	onRangeInput,
	onRangeChangeEnd,
	onPartyClick,
	onPartyRightClick,
	onEthnicityClick,
	onEthnicityRightClick,
	onPointLegendClick,
	onPointLegendRightClick,
	onNetworkClick,
	onNetworkRightClick,
}: LegendContentProps) {
	if (!activeDataset) return null;

	const rangeControls = {
		displayOptions,
		verticalThemeGradient,
		overlayOpacity,
		onRangeInput,
		onRangeChangeEnd,
	};
	const chartDefinition = getChartDatasetDefinition(activeDataset.type);
	const declared = declaredMeasure(activeDataset.type, displayOptions);
	if (declared) {
		const { legend } = declared;
		return (
			<DynamicRangeLegend
				{...rangeControls}
				datasetKey={activeDataset.type as ColorRangeDatasetKey}
				absoluteRange={{ min: legend.min, max: legend.max }}
				defaultRange={declared.colorRange}
				formatLabel={(value) => formatDisplay(legend.format, value)}
			/>
		);
	}
	if (chartDefinition?.map) {
		const { colorRange, legend, getColorRange } = chartDefinition.map;
		const unemploymentMeasure =
			activeDataset.type === "unemployment"
				? displayOptions.unemployment.measure
				: null;
		const unemploymentLegend = unemploymentMeasure
			? {
					min: unemploymentMeasure === "count" ? 0 : 2.2,
					max: unemploymentMeasure === "count" ? 45000 : 6.8,
					format: (value: number) =>
						unemploymentMeasure === "count"
							? `${value.toLocaleString()} unemployed`
							: `${value.toFixed(1)}%`,
				}
			: null;
		const schoolPerformanceMeasure =
			activeDataset.type === "schoolPerformance"
				? displayOptions.schoolPerformance.measure
				: null;
		const schoolPerformanceLegend = schoolPerformanceMeasure
			? {
					min: schoolPerformanceMeasure === "progress8" ? -1 : 0,
					max:
						schoolPerformanceMeasure === "attainment8"
							? 70
							: schoolPerformanceMeasure === "progress8"
								? 1
								: 100,
					format: (value: number) =>
						schoolPerformanceMeasure === "attainment8"
							? `${value.toFixed(0)} Attainment 8`
							: schoolPerformanceMeasure === "progress8"
								? `${value.toFixed(1)} Progress 8`
								: `${value.toFixed(0)}% grade ${schoolPerformanceMeasure === "grade5" ? "5+" : "4+"}`,
				}
			: null;
		const measureLegend =
			schoolPerformanceLegend ?? unemploymentLegend ?? legend;
		const dynamicRange = getColorRange?.(
			activeDataset as never,
			displayOptions,
		);
		const configuredRange =
			displayOptions[activeDataset.type as ColorRangeDatasetKey]
				.colorRange;
		const usesInitialRange =
			dynamicRange &&
			configuredRange.min === colorRange.min &&
			configuredRange.max === colorRange.max;
		return (
			<DynamicRangeLegend
				{...rangeControls}
				datasetKey={activeDataset.type as ColorRangeDatasetKey}
				absoluteRange={{
					min:
						dynamicRange?.min ??
						legend.bounds?.(displayOptions).min ??
						measureLegend.min,
					max:
						dynamicRange?.max ??
						legend.bounds?.(displayOptions).max ??
						measureLegend.max,
				}}
				defaultRange={{
					min: dynamicRange?.min ?? colorRange.min,
					max: dynamicRange?.max ?? colorRange.max,
				}}
				formatLabel={
					schoolPerformanceLegend?.format ??
					unemploymentLegend?.format ??
					((value) => measureLegend.format(value, displayOptions))
				}
				currentRange={usesInitialRange ? dynamicRange : undefined}
			/>
		);
	}

	switch (chartDefinition?.legendKind) {
		case "population":
			return (
				<PopulationLegend {...rangeControls} activeViz={activeViz} />
			);

		case "ethnicity":
			return (
				<EthnicityLegend
					displayOptions={displayOptions}
					overlayOpacity={overlayOpacity}
					isDark={isDark}
					ethnicities={ethnicities}
					onClick={onEthnicityClick}
					onRightClick={onEthnicityRightClick}
				/>
			);

		case "party":
			if (
				activeDataset.type !== "generalElection" &&
				activeDataset.type !== "localElection"
			) {
				return null;
			}
			return (
				<PartyLegend
					displayOptions={displayOptions}
					overlayOpacity={overlayOpacity}
					isDark={isDark}
					parties={parties}
					datasetType={activeDataset.type}
					onClick={onPartyClick}
					onRightClick={onPartyRightClick}
				/>
			);

		case "brexit":
			if (
				activeDataset.type !== "brexit" &&
				activeDataset.type !== "brexitConstituency"
			) {
				return null;
			}
			return (
				<BrexitLegend
					{...rangeControls}
					datasetKey={activeDataset.type}
				/>
			);
	}

	switch (activeDataset.type) {
		case "network":
			if (!activeDataset.legend) return null;
			return (
				<NetworkLegend
					displayOptions={displayOptions}
					overlayOpacity={overlayOpacity}
					isDark={isDark}
					items={activeDataset.legend.map((item) => ({
						id: item.id,
						color: item.color,
						name: item.label,
					}))}
					onClick={onNetworkClick}
					onRightClick={onNetworkRightClick}
				/>
			);

		case "custom":
			return (
				<CustomLegend
					{...rangeControls}
					dataset={activeDataset}
					isDark={isDark}
					onPointLegendClick={onPointLegendClick}
					onPointLegendRightClick={onPointLegendRightClick}
				/>
			);

		default:
			return null;
	}
}
