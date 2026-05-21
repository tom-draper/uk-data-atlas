// components/LegendPanel.tsx
"use client";

import { memo, useMemo, useState } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS, themes } from "@/lib/helpers/colorScale";
import type { MapOptions, CategoryOptions } from "@/lib/types/mapOptions";
import { ActiveViz, AggregatedData, Dataset, PartyCode, EthnicityCode, Ethnicity, EthnicityCategory, WardStats, ConstituencyStats } from "@/lib/types";
import { RangeControl } from "./controls/RangeControl";

type PartyDisplayData = { id: PartyCode; color: string; name: string };

type ColorRangeDatasetKey =
	| "ageDistribution"
	| "populationDensity"
	| "gender"
	| "housePrice"
	| "crime"
	| "income"
	| "brexit"
	| "brexitConstituency"
	| "imd"
	| "lifeExpectancy"
	| "custom";

interface LegendPanelProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	aggregatedData: AggregatedData | null;
	mapOptions: MapOptions;
	onMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
}

// Renders a scrollable list of selectable colour-coded categories (parties or ethnicities)
const renderCategoryLegend = (
	items: { id: string; color: string; name: string }[],
	isPercentageMode: boolean,
	selectedId: string | undefined,
	onItemClick: (id: string) => void,
	swatchOpacity: number = 1,
) => (
	<div>
		{items.map((item) => {
			const isSelected = isPercentageMode && selectedId === item.id;
			return (
				<button
					key={item.id}
					onClick={() => onItemClick(item.id)}
					className={`flex items-center gap-2 px-1 py-0.75 w-full text-left rounded-sm transition-all cursor-pointer ${isSelected ? "ring-1" : "hover:bg-gray-100/30"}`}
					style={isSelected ? ({ backgroundColor: `${item.color}15`, "--tw-ring-color": `${item.color}80` } as React.CSSProperties) : {}}
				>
					<div
						className={`w-3 h-3 rounded-xs shrink-0 transition-opacity ${isSelected ? "ring-1" : ""}`}
						style={{ backgroundColor: item.color, opacity: swatchOpacity, ...(isSelected ? ({ "--tw-ring-color": item.color } as React.CSSProperties) : {}) }}
					/>
					<span className={`text-xs ${isSelected ? "text-gray-700" : "text-gray-500"}`}>
						{item.name}
					</span>
				</button>
			);
		})}
	</div>
);

// Secondary panel for the percentage-range slider shown when a party/ethnicity is selected
const PercentageRangePanel = memo(function PercentageRangePanel({
	range,
	gradient,
	opacity,
	onRangeInput,
	onRangeChangeEnd,
}: {
	range: { min: number; max: number };
	gradient: string;
	opacity: number;
	onRangeInput: (min: number, max: number) => void;
	onRangeChangeEnd: () => void;
}) {
	return (
		<div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30 w-fit ml-auto">
			<div className="bg-white/20 p-1 overflow-hidden">
				<RangeControl
					min={0}
					max={100}
					currentMin={range.min}
					currentMax={range.max}
					gradient={gradient}
					labels={[`${range.max.toFixed(0)}%`, "", "", "", `${range.min.toFixed(0)}%`]}
					opacity={opacity}
					onRangeInput={onRangeInput}
					onRangeChangeEnd={onRangeChangeEnd}
				/>
			</div>
		</div>
	);
});

export default memo(function LegendPanel({
	activeDataset,
	activeViz,
	aggregatedData,
	mapOptions,
	onMapOptionsChange,
}: LegendPanelProps) {
	const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);

	// Use liveOptions if dragging, otherwise fall back to mapOptions from props
	const displayOptions = liveOptions || mapOptions;

	const themeId = displayOptions.theme.id;
	const activeTheme = useMemo(
		() => themes.find((t) => t.id === themeId) || themes[0],
		[themeId],
	);

	const verticalThemeGradient = useMemo(
		() => `linear-gradient(to bottom, ${activeTheme.colors.join(", ")})`,
		[activeTheme],
	);

	const parties = useMemo(() => {
		if (!activeDataset) return [];

		let datasetData:
			| Record<number, WardStats>
			| Record<number, ConstituencyStats>
			| undefined;

		if (activeDataset.type === "localElection") {
			datasetData = aggregatedData?.localElection ?? undefined;
		} else if (activeDataset.type === "generalElection") {
			datasetData = aggregatedData?.generalElection ?? undefined;
		}

		if (!datasetData) return [];

		const yearData = datasetData[activeDataset.year];
		if (!yearData?.partyVotes) return [];

		return Object.entries(yearData.partyVotes as Record<PartyCode, number>)
			.filter(([_, votes]) => votes > 0)
			.sort((a, b) => b[1] - a[1])
			.map(([id, _]) => ({
				id: id as PartyCode,
				color: PARTIES[id as PartyCode]?.color || "#ccc",
				name: PARTIES[id as PartyCode]?.name || id,
			}));
	}, [aggregatedData, activeDataset]);

	const ethnicities = useMemo(() => {
		if (!activeDataset || activeDataset.type !== "ethnicity") return [];
		const yearData = aggregatedData?.ethnicity?.[activeDataset.year];
		if (!yearData) return [];

		const ethnicityTotals = new Map<string, number>();
		for (const localAuthorityData of Object.values(yearData) as EthnicityCategory[]) {
			for (const [ethnicity, data] of Object.entries(localAuthorityData) as [string, Ethnicity][]) {
				const currentTotal = ethnicityTotals.get(ethnicity) || 0;
				if (typeof data.population === "number") {
					ethnicityTotals.set(ethnicity, currentTotal + data.population);
				}
			}
		}

		return Array.from(ethnicityTotals.entries())
			.filter(([_, count]) => count > 0)
			.sort((a, b) => b[1] - a[1])
			.map(([id]: [EthnicityCode, number]) => ({
				id,
				color: ETHNICITY_COLORS[id] || "#ccc",
				name: id,
			}));
	}, [aggregatedData, activeDataset]);

	const handleRangeInput = (datasetKey: ColorRangeDatasetKey, min: number, max: number) => {
		setLiveOptions((prev) => {
			const base = prev || mapOptions;
			return { ...base, [datasetKey]: { ...base[datasetKey], colorRange: { min, max } } };
		});
	};

	const handleRangeChangeEnd = (datasetKey: ColorRangeDatasetKey) => {
		if (!liveOptions) return;
		const range = liveOptions[datasetKey]?.colorRange;
		if (range) onMapOptionsChange(datasetKey, { colorRange: range });
		setLiveOptions(null);
	};

	const handlePartyClick = (partyCode: PartyCode) => {
		const datasetType = activeDataset?.type;
		if (!datasetType || (datasetType !== "generalElection" && datasetType !== "localElection")) return;

		const options = displayOptions[datasetType];
		if (options.mode === "percentage" && options.selected === partyCode) {
			onMapOptionsChange(datasetType, { mode: "majority", selected: undefined });
		} else {
			onMapOptionsChange(datasetType, { mode: "percentage", selected: partyCode });
		}
	};

	const handleEthnicityClick = (ethnicityCode: EthnicityCode) => {
		if (activeDataset?.type !== "ethnicity") return;
		const { mode, selected } = displayOptions.ethnicity;
		if (mode === "percentage" && selected === ethnicityCode) {
			onMapOptionsChange("ethnicity", { mode: "majority", selected: undefined });
		} else {
			onMapOptionsChange("ethnicity", { mode: "percentage", selected: ethnicityCode });
		}
	};

	const overlayOpacity = Math.min(1, (displayOptions.visibility.overlayOpacity ?? 1) + 0.2);

	const renderDynamicLegend = (
		datasetKey: ColorRangeDatasetKey,
		absMin: number,
		absMax: number,
		defaultMin: number,
		defaultMax: number,
		formatLabel: (v: number) => string = (v) => v.toFixed(0),
	) => {
		const currentMin = displayOptions[datasetKey].colorRange?.min ?? defaultMin;
		const currentMax = displayOptions[datasetKey].colorRange?.max ?? defaultMax;

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
				onRangeInput={(min, max) => handleRangeInput(datasetKey, min, max)}
				onRangeChangeEnd={() => handleRangeChangeEnd(datasetKey)}
			/>
		);
	};

	const renderLegendContent = () => {
		if (!activeDataset) return null;

		const formatCurrency = (val: number) => {
			if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
			if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}K`;
			return `£${val.toFixed(0)}`;
		};

		switch (activeDataset.type) {
			case "population":
				if (activeViz.vizId.startsWith("ageDistribution")) {
					return renderDynamicLegend("ageDistribution", 18, 80, 25, 55);
				}
				if (activeViz.vizId.startsWith("populationDensity")) {
					return renderDynamicLegend("populationDensity", 0, 15000, 500, 8000);
				}
				if (activeViz.vizId.startsWith("gender")) {
					const currentMin = displayOptions.gender?.colorRange?.min ?? -0.1;
					const currentMax = displayOptions.gender?.colorRange?.max ?? 0.1;
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
							onRangeInput={(min, max) => handleRangeInput("gender", min, max)}
							onRangeChangeEnd={() => handleRangeChangeEnd("gender")}
						/>
					);
				}
				return null;

			case "housePrice":
				return renderDynamicLegend("housePrice", 0, 2000000, 80000, 500000, formatCurrency);

			case "income":
				return renderDynamicLegend("income", 0, 100000, 80000, 450000, formatCurrency);

			case "crime":
				return renderDynamicLegend("crime", 0, 150000, 10000, 100000);

			case "imd":
				return renderDynamicLegend("imd", 0, 80, 1, 70);

			case "ethnicity": {
				const opts = displayOptions.ethnicity;
				return renderCategoryLegend(
					ethnicities,
					opts?.mode === "percentage",
					opts?.selected,
					(id) => handleEthnicityClick(id as EthnicityCode),
					overlayOpacity,
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
					(id) => handlePartyClick(id as PartyCode),
					overlayOpacity,
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
						onRangeInput={(min, max) => handleRangeInput(key, min, max)}
						onRangeChangeEnd={() => handleRangeChangeEnd(key)}
					/>
				);
			}

			case "lifeExpectancy": {
				const leData = Object.values(activeDataset.data).map((r: any) => (r.maleBirthLE + r.femaleBirthLE) / 2);
				const leMin = leData.length ? Math.min(...leData) : 55;
				const leMax = leData.length ? Math.max(...leData) : 85;
				return renderDynamicLegend("lifeExpectancy", leMin, leMax, leMin, leMax, (v) => `${v.toFixed(1)}y`);
			}

			case "custom":
				return renderDynamicLegend("custom", 0, 100, 0, 100);

			default:
				return null;
		}
	};

	// Derive election percentage range panel state
	const electionType = (["generalElection", "localElection"].includes(activeDataset?.type || "")
		? activeDataset!.type as "generalElection" | "localElection"
		: null);
	const electionOpts = electionType ? displayOptions[electionType] : null;
	const showElectionPct = electionOpts?.mode === "percentage";

	// Derive ethnicity percentage range panel state
	const ethnicityOpts = displayOptions.ethnicity;
	const showEthnicityPct = activeDataset?.type === "ethnicity" && ethnicityOpts?.mode === "percentage";

	return (
		<div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full gap-2.5">
			<div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30">
				<div className="bg-white/20 p-1 overflow-hidden">
					{renderLegendContent()}
				</div>
			</div>

			{showElectionPct && electionType && electionOpts && (
				<PercentageRangePanel
					range={{
						min: electionOpts.percentageRange?.min ?? 0,
						max: (electionOpts as CategoryOptions).percentageRange?.max ?? 100,
					}}
					gradient={`linear-gradient(to bottom, ${PARTIES[electionOpts.selected as PartyCode]?.color || "#999"}, #f5f5f5)`}
					opacity={overlayOpacity}
					onRangeInput={(min, max) => {
						setLiveOptions((prev) => {
							const base = prev || mapOptions;
							return { ...base, [electionType]: { ...base[electionType], percentageRange: { min, max } } };
						});
					}}
					onRangeChangeEnd={() => {
						if (!liveOptions) return;
						onMapOptionsChange(electionType, { percentageRange: liveOptions[electionType].percentageRange });
						setLiveOptions(null);
					}}
				/>
			)}

			{showEthnicityPct && (
				<PercentageRangePanel
					range={{
						min: ethnicityOpts.percentageRange?.min ?? 0,
						max: (ethnicityOpts as CategoryOptions).percentageRange?.max ?? 100,
					}}
					gradient={`linear-gradient(to bottom, ${ETHNICITY_COLORS[ethnicityOpts.selected as EthnicityCode] || "#999"}, #f5f5f5)`}
					opacity={overlayOpacity}
					onRangeInput={(min, max) => {
						setLiveOptions((prev) => {
							const base = prev || mapOptions;
							return { ...base, ethnicity: { ...base.ethnicity, percentageRange: { min, max } } };
						});
					}}
					onRangeChangeEnd={() => {
						if (!liveOptions) return;
						onMapOptionsChange("ethnicity", { percentageRange: liveOptions.ethnicity.percentageRange });
						setLiveOptions(null);
					}}
				/>
			)}
		</div>
	);
});
