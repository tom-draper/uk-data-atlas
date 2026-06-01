"use client";
import type { ActiveViz, Dataset, PartyCode, EthnicityCode } from "@lib/types";
import type { MapOptions, CategoryOptions } from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey, PartyDisplayData } from "./LegendPanel";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS } from "@/lib/helpers/colorScale";
import { RangeControl } from "./controls/RangeControl";
import { renderCategoryLegend } from "./legendUtils";

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
	onEthnicityClick: (id: string) => void;
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
	onEthnicityClick,
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
			return renderDynamicLegend("simd", 1, 6976, 1, 6976, (v) =>
				v <= 1
					? "Most deprived"
					: v >= 6975
						? "Least deprived"
						: `Rank ${Math.round(v).toLocaleString()}`,
			);

		case "wimd":
			return renderDynamicLegend("wimd", 1, 1909, 1, 1909, (v) =>
				v <= 1
					? "Most deprived"
					: v >= 1908
						? "Least deprived"
						: `Rank ${Math.round(v).toLocaleString()}`,
			);

		case "nimdm":
			return renderDynamicLegend("nimdm", 1, 890, 1, 890, (v) =>
				v <= 1
					? "Most deprived"
					: v >= 889
						? "Least deprived"
						: `Rank ${Math.round(v).toLocaleString()}`,
			);

		case "ethnicity": {
			const opts = displayOptions.ethnicity;
			return renderCategoryLegend(
				ethnicities,
				opts?.mode === "percentage",
				opts?.selected,
				onEthnicityClick,
				overlayOpacity,
				isDark,
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

		case "custom":
			return renderDynamicLegend("custom", 0, 100, 0, 100);

		default:
			return null;
	}
}
