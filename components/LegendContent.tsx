"use client";
import type { ActiveViz, Dataset, EthnicityCode } from "@lib/types";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey, PartyDisplayData } from "./LegendPanel";
import { RangeControl } from "./controls/RangeControl";
import { renderCategoryLegend } from "./legendUtils";
import { getChartDatasetDefinition } from "@/lib/datasets";

interface LegendContentProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	displayOptions: MapOptions;
	verticalThemeGradient: string;
	overlayOpacity: number;
	isDark: boolean;
	parties: PartyDisplayData[];
	ethnicities: { id: EthnicityCode; color: string; name: string }[];
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

const defaultFormatLabel = (v: number) => v.toFixed(0);

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

	const formatCurrency = (val: number) => {
		if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}K`;
		return `£${val.toFixed(0)}`;
	};

	const renderDynamicLegend = (
		datasetKey: ColorRangeDatasetKey,
		absMin: number,
		absMax: number,
		defaultMin: number,
		defaultMax: number,
		formatLabel: (v: number) => string = defaultFormatLabel,
	) => {
		const currentMin =
			displayOptions[datasetKey].colorRange?.min ?? defaultMin;
		const currentMax =
			displayOptions[datasetKey].colorRange?.max ?? defaultMax;

		const labels = [
			formatLabel(currentMax),
			formatLabel((currentMax - currentMin) * 0.75 + currentMin),
			formatLabel((currentMax - currentMin) * 0.5 + currentMin),
			formatLabel((currentMax - currentMin) * 0.25 + currentMin),
			formatLabel(currentMin),
		];

		return (
			<RangeControl
				min={absMin}
				max={absMax}
				currentMin={currentMin}
				currentMax={currentMax}
				gradient={verticalThemeGradient}
				labels={labels}
				opacity={overlayOpacity}
				onRangeInput={(min, max) => onRangeInput(datasetKey, min, max)}
				onRangeChangeEnd={() => onRangeChangeEnd(datasetKey)}
			/>
		);
	};

	switch (activeDataset.type) {
		case "network": {
			if (!activeDataset.legend) return null;
			const networkOpts = displayOptions.network;
			return renderCategoryLegend(
				activeDataset.legend.map((item) => ({
					id: item.id,
					color: item.color,
					name: item.label,
				})),
				true,
				networkOpts?.selected,
				onNetworkClick,
				overlayOpacity,
				isDark,
				new Set(networkOpts?.excluded ?? []),
				onNetworkRightClick,
			);
		}

		case "population":
			if (activeViz.vizId.startsWith("ageDistribution")) {
				return renderDynamicLegend("ageDistribution", 18, 80, 25, 55);
			}
			if (activeViz.vizId.startsWith("populationDensity")) {
				return renderDynamicLegend(
					"populationDensity",
					0,
					15000,
					500,
					8000,
				);
			}
			if (activeViz.vizId.startsWith("gender")) {
				const currentMin =
					displayOptions.gender?.colorRange?.min ?? -0.1;
				const currentMax =
					displayOptions.gender?.colorRange?.max ?? 0.1;
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
						opacity={overlayOpacity}
						onRangeInput={(min, max) =>
							onRangeInput("gender", min, max)
						}
						onRangeChangeEnd={() => onRangeChangeEnd("gender")}
					/>
				);
			}
			return null;

		case "housePrice":
			return renderDynamicLegend(
				"housePrice",
				0,
				2000000,
				80000,
				500000,
				formatCurrency,
			);

		case "income":
			return renderDynamicLegend(
				"income",
				0,
				100000,
				80000,
				450000,
				formatCurrency,
			);

		case "crime":
			return renderDynamicLegend("crime", 0, 150000, 10000, 100000);

		case "imd":
			return renderDynamicLegend("imd", 0, 80, 1, 70);

		case "simd":
			return renderDynamicLegend("simd", 1, 6976, 1, 6976, (v) => {
				const r = 6977 - v;
				return r <= 1 ? "Most deprived" : r >= 6976 ? "Least deprived" : `Rank ${Math.round(r).toLocaleString()}`;
			});

		case "wimd":
			return renderDynamicLegend("wimd", 1, 1909, 1, 1909, (v) => {
				const r = 1910 - v;
				return r <= 1 ? "Most deprived" : r >= 1909 ? "Least deprived" : `Rank ${Math.round(r).toLocaleString()}`;
			});

		case "nimdm":
			return renderDynamicLegend("nimdm", 1, 890, 1, 890, (v) => {
				const r = 891 - v;
				return r <= 1 ? "Most deprived" : r >= 890 ? "Least deprived" : `Rank ${Math.round(r).toLocaleString()}`;
			});

		case "ethnicity": {
			const opts = displayOptions.ethnicity;
			return renderCategoryLegend(
				ethnicities,
				opts?.mode === "percentage",
				opts?.selected,
				onEthnicityClick,
				overlayOpacity,
				isDark,
				new Set(opts?.excluded ?? []),
				onEthnicityRightClick,
			);
		}

		case "generalElection":
		case "localElection": {
			const type = activeDataset.type;
			const opts = displayOptions[type];
			return renderCategoryLegend(
				parties,
				opts?.mode === "percentage",
				opts?.selected,
				onPartyClick,
				overlayOpacity,
				isDark,
				new Set(opts?.excluded ?? []),
				onPartyRightClick,
			);
		}

		case "brexitConstituency":
		case "brexit": {
			const key = activeDataset.type as "brexit" | "brexitConstituency";
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

		case "lifeExpectancy": {
			const leData = Object.values(activeDataset.data).map(
				(r: any) => (r.maleBirthLE + r.femaleBirthLE) / 2,
			);
			const leMin = leData.length ? Math.min(...leData) : 55;
			const leMax = leData.length ? Math.max(...leData) : 85;
			return renderDynamicLegend(
				"lifeExpectancy",
				leMin,
				leMax,
				leMin,
				leMax,
				(v) => `${v.toFixed(1)}y`,
			);
		}

		case "qualification":
			return renderDynamicLegend(
				"qualification",
				0,
				100,
				25,
				60,
				(v) => `${v.toFixed(0)}% Level 4+`,
			);

		case "broadband":
			return renderDynamicLegend(
				"broadband",
				0,
				100,
				50,
				100,
				(v) => `${v.toFixed(0)}% full fibre`,
			);

		case "airQuality":
			return renderDynamicLegend(
				"airQuality",
				0,
				60,
				5,
				35,
				(v) => `${v.toFixed(0)} µg/m³ NO₂`,
			);

		case "schoolPerformance":
			return renderDynamicLegend(
				"schoolPerformance",
				0,
				100,
				50,
				80,
				(v) => `${v.toFixed(0)}% grade 4+`,
			);

		case "claimantCount":
			return renderDynamicLegend(
				"claimantCount",
				0,
				20,
				1,
				8,
				(v) => `${v.toFixed(1)}% rate`,
			);

		case "nhsWaiting":
			return renderDynamicLegend(
				"nhsWaiting",
				0,
				100,
				0,
				40,
				(v) => `${v.toFixed(0)}% >18wks`,
			);

		case "unemployment":
			return renderDynamicLegend(
				"unemployment",
				0,
				20,
				2,
				8,
				(v) => `${v.toFixed(1)}% rate`,
			);

		case "custom":
			if (
				activeDataset.kind === "points" &&
				activeDataset.pointStyle?.legend
			) {
				const { colorByValue, legend } = activeDataset.pointStyle;
				return renderCategoryLegend(
					legend.map(({ value, label }) => ({
						id: String(value),
						color: colorByValue?.[value] ?? "#999",
						name: label,
					})),
					displayOptions.custom.selectedPointValue !== undefined,
					String(displayOptions.custom.selectedPointValue),
					onPointLegendClick,
					overlayOpacity,
					isDark,
					new Set(
						(displayOptions.custom.excludedPointValues ?? []).map(String),
					),
					onPointLegendRightClick,
				);
			}
			return renderDynamicLegend("custom", 0, 100, 0, 100);

		default: {
			// Datasets with a registry entry but no dedicated case above
			// (e.g. childPoverty, fuelPoverty, homelessness) fall back to a
			// generic colour-range legend built from their registry metadata.
			const chartDefinition = getChartDatasetDefinition(activeDataset.type);
			if (!chartDefinition?.map) return null;
			const { colorRange, legend } = chartDefinition.map;
			return renderDynamicLegend(
				activeDataset.type as ColorRangeDatasetKey,
				legend.min,
				legend.max,
				colorRange.min,
				colorRange.max,
				legend.format,
			);
		}
	}
}
