// components/LegendPanel.tsx
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS, themes } from "@/lib/helpers/colorScale";
import type { MapOptions, CategoryOptions } from "@/lib/types/mapOptions";
import {
	ActiveViz,
	AggregatedData,
	Dataset,
	PartyCode,
	EthnicityCode,
	Ethnicity,
	EthnicityCategory,
	WardStats,
	ConstituencyStats,
} from "@/lib/types";
import { RangeControl } from "./controls/RangeControl";
import { useIsDark } from "@/lib/context/ThemeContext";
import LegendContent from "./LegendContent";
import { panelTheme } from "@/lib/helpers/panelTheme";

export type PartyDisplayData = { id: PartyCode; color: string; name: string };

export type ColorRangeDatasetKey =
	| "ageDistribution"
	| "populationDensity"
	| "gender"
	| "housePrice"
	| "crime"
	| "income"
	| "brexit"
	| "brexitConstituency"
	| "imd"
	| "simd"
	| "wimd"
	| "nimdm"
	| "lifeExpectancy"
	| "qualification"
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
	isDark: boolean = false,
) => (
	<div>
		{items.map((item) => {
			const isSelected = isPercentageMode && selectedId === item.id;
			return (
				<button
					type="button"
					key={item.id}
					onClick={() => onItemClick(item.id)}
					className={`flex items-center gap-2 px-1 py-0.75 w-full text-left rounded-sm transition-all cursor-pointer ${isSelected ? "ring-1" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100/30"}`}
					style={
						isSelected
							? ({
									backgroundColor: `${item.color}15`,
									"--tw-ring-color": `${item.color}80`,
								} as React.CSSProperties)
							: {}
					}
				>
					<div
						className={`w-3 h-3 rounded-xs shrink-0 transition-opacity ${isSelected ? "ring-1" : ""}`}
						style={{
							backgroundColor: item.color,
							opacity: swatchOpacity,
							...(isSelected
								? ({
										"--tw-ring-color": item.color,
									} as React.CSSProperties)
								: {}),
						}}
					/>
					<span
						className={`text-xs ${isSelected ? (isDark ? "text-gray-100" : "text-gray-700") : isDark ? "text-gray-400" : "text-gray-500"}`}
					>
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
	const isDark = useIsDark();
	const t = panelTheme(isDark);
	return (
		<div
			className={`pointer-events-auto rounded-md backdrop-blur-md shadow-lg border w-fit ml-auto ${t.panel}`}
		>
			<div className={`${t.section} p-1 overflow-hidden`}>
				<RangeControl
					min={0}
					max={100}
					currentMin={range.min}
					currentMax={range.max}
					gradient={gradient}
					labels={[
						`${range.max.toFixed(0)}%`,
						"",
						"",
						"",
						`${range.min.toFixed(0)}%`,
					]}
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

	const verticalThemeGradient = `linear-gradient(to bottom, ${activeTheme.colors.join(", ")})`;

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
		for (const localAuthorityData of Object.values(
			yearData,
		) as EthnicityCategory[]) {
			for (const [ethnicity, data] of Object.entries(
				localAuthorityData,
			) as [string, Ethnicity][]) {
				const currentTotal = ethnicityTotals.get(ethnicity) || 0;
				if (typeof data.population === "number") {
					ethnicityTotals.set(
						ethnicity,
						currentTotal + data.population,
					);
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

	const handleRangeInput = (
		datasetKey: ColorRangeDatasetKey,
		min: number,
		max: number,
	) => {
		setLiveOptions((prev) => {
			const base = prev || mapOptions;
			return {
				...base,
				[datasetKey]: { ...base[datasetKey], colorRange: { min, max } },
			};
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
		if (
			!datasetType ||
			(datasetType !== "generalElection" &&
				datasetType !== "localElection")
		)
			return;

		const options = displayOptions[datasetType];
		if (options.mode === "percentage" && options.selected === partyCode) {
			onMapOptionsChange(datasetType, {
				mode: "majority",
				selected: undefined,
			});
		} else {
			onMapOptionsChange(datasetType, {
				mode: "percentage",
				selected: partyCode,
			});
		}
	};

	const handleEthnicityClick = (ethnicityCode: EthnicityCode) => {
		if (activeDataset?.type !== "ethnicity") return;
		const { mode, selected } = displayOptions.ethnicity;
		if (mode === "percentage" && selected === ethnicityCode) {
			onMapOptionsChange("ethnicity", {
				mode: "majority",
				selected: undefined,
			});
		} else {
			onMapOptionsChange("ethnicity", {
				mode: "percentage",
				selected: ethnicityCode,
			});
		}
	};

	const overlayOpacity = Math.min(
		1,
		(displayOptions.visibility.overlayOpacity ?? 1) + 0.2,
	);

	// Derive election percentage range panel state
	const electionType = ["generalElection", "localElection"].includes(
		activeDataset?.type || "",
	)
		? (activeDataset!.type as "generalElection" | "localElection")
		: null;
	const electionOpts = electionType ? displayOptions[electionType] : null;
	const showElectionPct = electionOpts?.mode === "percentage";

	// Derive ethnicity percentage range panel state
	const ethnicityOpts = displayOptions.ethnicity;
	const showEthnicityPct =
		activeDataset?.type === "ethnicity" &&
		ethnicityOpts?.mode === "percentage";

	const isDark = useIsDark();
	const t = panelTheme(isDark);

	const electionRange = useMemo(
		() => ({
			min: electionOpts?.percentageRange?.min ?? 0,
			max:
				(electionOpts as CategoryOptions | null)?.percentageRange
					?.max ?? 100,
		}),
		[electionOpts],
	);
	const handleElectionRangeInput = useCallback(
		(min: number, max: number) => {
			if (!electionType) return;
			setLiveOptions((prev) => {
				const base = prev || mapOptions;
				return {
					...base,
					[electionType]: {
						...base[electionType],
						percentageRange: { min, max },
					},
				};
			});
		},
		[electionType, mapOptions],
	);
	const handleElectionRangeChangeEnd = useCallback(() => {
		if (!liveOptions || !electionType) return;
		onMapOptionsChange(electionType, {
			percentageRange: liveOptions[electionType].percentageRange,
		});
		setLiveOptions(null);
	}, [liveOptions, electionType, onMapOptionsChange]);

	const ethnicityRange = useMemo(
		() => ({
			min: ethnicityOpts?.percentageRange?.min ?? 0,
			max:
				(ethnicityOpts as CategoryOptions)?.percentageRange?.max ?? 100,
		}),
		[ethnicityOpts],
	);
	const handleEthnicityRangeInput = useCallback(
		(min: number, max: number) => {
			setLiveOptions((prev) => {
				const base = prev || mapOptions;
				return {
					...base,
					ethnicity: {
						...base.ethnicity,
						percentageRange: { min, max },
					},
				};
			});
		},
		[mapOptions],
	);
	const handleEthnicityRangeChangeEnd = useCallback(() => {
		if (!liveOptions) return;
		onMapOptionsChange("ethnicity", {
			percentageRange: liveOptions.ethnicity.percentageRange,
		});
		setLiveOptions(null);
	}, [liveOptions, onMapOptionsChange]);

	return (
		<div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full gap-2.5">
			<div
				className={`pointer-events-auto rounded-md backdrop-blur-md shadow-lg border ${t.panel}`}
			>
				<div className={`${t.section} p-1 overflow-hidden`}>
					<LegendContent
						activeDataset={activeDataset}
						activeViz={activeViz}
						displayOptions={displayOptions}
						verticalThemeGradient={verticalThemeGradient}
						overlayOpacity={overlayOpacity}
						isDark={isDark}
						parties={parties}
						ethnicities={ethnicities}
						onRangeInput={handleRangeInput}
						onRangeChangeEnd={handleRangeChangeEnd}
						onPartyClick={(id) => handlePartyClick(id as PartyCode)}
						onEthnicityClick={(id) =>
							handleEthnicityClick(id as EthnicityCode)
						}
					/>
				</div>
			</div>

			{showElectionPct && electionType && electionOpts && (
				<PercentageRangePanel
					range={electionRange}
					gradient={`linear-gradient(to bottom, ${PARTIES[electionOpts.selected as PartyCode]?.color || "#999"}, ${isDark ? "#1f2937" : "#f5f5f5"})`}
					opacity={overlayOpacity}
					onRangeInput={handleElectionRangeInput}
					onRangeChangeEnd={handleElectionRangeChangeEnd}
				/>
			)}

			{showEthnicityPct && (
				<PercentageRangePanel
					range={ethnicityRange}
					gradient={`linear-gradient(to bottom, ${ETHNICITY_COLORS[ethnicityOpts.selected as EthnicityCode] || "#999"}, ${isDark ? "#1f2937" : "#f5f5f5"})`}
					opacity={overlayOpacity}
					onRangeInput={handleEthnicityRangeInput}
					onRangeChangeEnd={handleEthnicityRangeChangeEnd}
				/>
			)}
		</div>
	);
});
