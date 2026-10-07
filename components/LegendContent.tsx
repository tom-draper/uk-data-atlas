"use client";

import type { ActiveViz, Dataset } from "@/lib/types";
import { getChartDatasetDefinition } from "@/lib/datasets";
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
	if (chartDefinition?.map) {
		const { colorRange, legend, getColorRange } = chartDefinition.map;
		const populationMetric =
			(activeDataset.type === "businessActivity" ||
				activeDataset.type === "electricVehicleChargers") &&
			displayOptions[activeDataset.type].measure === "perPopulation";
		const broadbandMeasure =
			activeDataset.type === "broadband"
				? displayOptions.broadband.measure
				: null;
		const broadbandLabel =
			broadbandMeasure === "superfast"
				? "superfast"
				: broadbandMeasure === "ultrafast"
					? "ultrafast"
					: broadbandMeasure === "gigabit"
						? "gigabit"
						: "full fibre";
		const airQualityMeasure =
			activeDataset.type === "airQuality"
				? displayOptions.airQuality.measure
				: null;
		const airQualityLabel =
			airQualityMeasure === "pm25"
				? "PM2.5"
				: airQualityMeasure === "pm10"
					? "PM10"
					: "NO₂";
		const ghgMeasure =
			activeDataset.type === "ghgEmissions"
				? displayOptions.ghgEmissions.measure
				: null;
		const ghgLegend = ghgMeasure
			? {
					min: 0,
					max: ghgMeasure === "perPerson" ? 20 : 6000,
					format: (value: number) =>
						ghgMeasure === "perPerson"
							? `${value.toFixed(0)} t CO₂e per person`
							: `${(value / 1000).toFixed(1)} Mt CO₂e${
									ghgMeasure === "excludingLandUse"
										? " excluding land use"
										: ""
								}`,
				}
			: null;
		const measureLegend = populationMetric
			? {
					min: 0,
					max:
						activeDataset.type === "businessActivity"
							? 20_000
							: 1_000,
					format: (value: number) =>
						`${value.toFixed(0)} per 100k residents`,
				}
			: broadbandMeasure
				? {
						min: 0,
						max: 100,
						format: (value: number) =>
							`${value.toFixed(0)}% ${broadbandLabel}`,
					}
				: airQualityMeasure
					? {
							min: 0,
							max: airQualityMeasure === "pm25" ? 20 : 35,
							format: (value: number) =>
								`${value.toFixed(0)} µg/m³ ${airQualityLabel}`,
						}
					: (ghgLegend ?? legend);
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
					min: dynamicRange?.min ?? measureLegend.min,
					max: dynamicRange?.max ?? measureLegend.max,
				}}
				defaultRange={{
					min: dynamicRange?.min ?? colorRange.min,
					max: dynamicRange?.max ?? colorRange.max,
				}}
				formatLabel={ghgLegend?.format ?? measureLegend.format}
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
