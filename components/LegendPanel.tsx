// components/LegendPanel.tsx
"use client";

import { useState } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { ETHNICITY_COLORS, themes } from "@/lib/helpers/colorScale";
import type { MapOptions, CategoryOptions } from "@/lib/types/mapOptions";
import {
	ActiveViz,
	Dataset,
	EthnicityDataset,
	GeneralElectionDataset,
	LocalElectionDataset,
	PartyCode,
	EthnicityCode,
	Ethnicity,
	EthnicityCategory,
	WardStats,
	ConstituencyStats,
} from "@/lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useAggregatedDataset } from "@/lib/hooks/useAggregatedDataset";
import { RangeControl } from "./controls/RangeControl";
import { useIsDark } from "@/lib/context/ThemeContext";
import LegendContent from "./LegendContent";
import { panelTheme, glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import type { ChartDatasetType } from "@/lib/datasets/generated";

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
	| "broadband"
	| "airQuality"
	| "schoolPerformance"
	| "claimantCount"
	| "nhsWaiting"
	| "unemployment"
	| ChartDatasetType
	| "custom";

interface LegendPanelProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	mapOptions: MapOptions;
	onMapOptionsChange: (
		type: keyof MapOptions,
		options: Partial<MapOptions[typeof type]>,
	) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
	datasets: {
		localElection: Record<string, LocalElectionDataset>;
		generalElection: Record<string, GeneralElectionDataset>;
		ethnicity: Record<string, EthnicityDataset>;
	};
}

function computeParties(
	activeDataset: Dataset | null,
	localElectionAgg: Record<string, any> | null,
	generalElectionAgg: Record<string, any> | null,
): PartyDisplayData[] {
	if (!activeDataset) return [];

	let datasetData:
		| Record<number, WardStats>
		| Record<number, ConstituencyStats>
		| undefined;

	if (activeDataset.type === "localElection") {
		datasetData = localElectionAgg ?? undefined;
	} else if (activeDataset.type === "generalElection") {
		datasetData = generalElectionAgg ?? undefined;
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
}

function computeEthnicities(
	activeDataset: Dataset | null,
	ethnicityAgg: Record<string, any> | null,
): { id: EthnicityCode; color: string; name: string }[] {
	if (!activeDataset || activeDataset.type !== "ethnicity") return [];
	const yearData = ethnicityAgg?.[activeDataset.year];
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
}

// Secondary panel for the percentage-range slider shown when a party/ethnicity is selected
function PercentageRangePanel({
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
			className={`pointer-events-auto rounded-md w-fit ml-auto relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div className={`relative ${t.section} p-1 overflow-hidden`} style={{ zIndex: 1 }}>
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
}

export default function LegendPanel({
	activeDataset,
	activeViz,
	mapOptions,
	onMapOptionsChange,
	mapManager,
	boundaryData,
	location,
	datasets,
}: LegendPanelProps) {
	const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);

	// Use liveOptions if dragging, otherwise fall back to mapOptions from props
	const displayOptions = liveOptions || mapOptions;

	const themeId = displayOptions.theme.id;
	const activeTheme = themes.find((t) => t.id === themeId) || themes[0];

	const verticalThemeGradient = `linear-gradient(to bottom, ${activeTheme.colors.join(", ")})`;

	const localElectionAgg = useAggregatedDataset({ datasets: datasets.localElection, boundaryType: "ward", calculateStats: (mm, g, d, loc, id) => mm.calculateLocalElectionStats(g, d, loc, id) }, mapManager, boundaryData, location);
	const generalElectionAgg = useAggregatedDataset({ datasets: datasets.generalElection, boundaryType: "constituency", calculateStats: (mm, g, d, loc, id) => mm.calculateGeneralElectionStats(g, d, loc, id) }, mapManager, boundaryData, location);
	const ethnicityAgg = useAggregatedDataset({ datasets: datasets.ethnicity, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateEthnicityStats(g, d, loc, id) }, mapManager, boundaryData, location);

	const parties = computeParties(activeDataset, localElectionAgg, generalElectionAgg);
	const ethnicities = computeEthnicities(activeDataset, ethnicityAgg);

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

	const handlePartyRightClick = (partyCode: PartyCode) => {
		const datasetType = activeDataset?.type;
		if (
			!datasetType ||
			(datasetType !== "generalElection" &&
				datasetType !== "localElection")
		)
			return;
		const current = displayOptions[datasetType].excluded ?? [];
		const next = current.includes(partyCode)
			? current.filter((p) => p !== partyCode)
			: [...current, partyCode];
		onMapOptionsChange(datasetType, { excluded: next });
	};

	const handleEthnicityRightClick = (ethnicityCode: EthnicityCode) => {
		if (activeDataset?.type !== "ethnicity") return;
		const current = displayOptions.ethnicity.excluded ?? [];
		const next = current.includes(ethnicityCode)
			? current.filter((e) => e !== ethnicityCode)
			: [...current, ethnicityCode];
		onMapOptionsChange("ethnicity", { excluded: next });
	};

	const handlePointLegendClick = (value: string) => {
		if (activeDataset?.type !== "custom" || activeDataset.kind !== "points")
			return;
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return;
		const selected = displayOptions.custom.selectedPointValue;
		onMapOptionsChange("custom", {
			selectedPointValue:
				selected === numericValue ? undefined : numericValue,
		});
	};

	const handlePointLegendRightClick = (value: string) => {
		if (activeDataset?.type !== "custom" || activeDataset.kind !== "points")
			return;
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return;
		const excluded = displayOptions.custom.excludedPointValues ?? [];
		onMapOptionsChange("custom", {
			excludedPointValues: excluded.includes(numericValue)
				? excluded.filter((item) => item !== numericValue)
				: [...excluded, numericValue],
			selectedPointValue:
				displayOptions.custom.selectedPointValue === numericValue
					? undefined
					: displayOptions.custom.selectedPointValue,
		});
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

	const electionRange = {
		min: electionOpts?.percentageRange?.min ?? 0,
		max:
			(electionOpts as CategoryOptions | null)?.percentageRange?.max ?? 100,
	};
	const handleElectionRangeInput = (min: number, max: number) => {
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
	};
	const handleElectionRangeChangeEnd = () => {
		if (!liveOptions || !electionType) return;
		onMapOptionsChange(electionType, {
			percentageRange: liveOptions[electionType].percentageRange,
		});
		setLiveOptions(null);
	};

	const ethnicityRange = {
		min: ethnicityOpts?.percentageRange?.min ?? 0,
		max: (ethnicityOpts as CategoryOptions)?.percentageRange?.max ?? 100,
	};
	const handleEthnicityRangeInput = (min: number, max: number) => {
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
	};
	const handleEthnicityRangeChangeEnd = () => {
		if (!liveOptions) return;
		onMapOptionsChange("ethnicity", {
			percentageRange: liveOptions.ethnicity.percentageRange,
		});
		setLiveOptions(null);
	};

	return (
		<div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full gap-2.5">
			<div
				className={`pointer-events-auto rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div className={`relative ${t.section} p-1 overflow-hidden`} style={{ zIndex: 1 }}>
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
						onPartyRightClick={(id) =>
							handlePartyRightClick(id as PartyCode)
						}
						onEthnicityClick={(id) =>
							handleEthnicityClick(id as EthnicityCode)
						}
						onEthnicityRightClick={(id) =>
							handleEthnicityRightClick(id as EthnicityCode)
							}
						onPointLegendClick={handlePointLegendClick}
						onPointLegendRightClick={handlePointLegendRightClick}
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
}
