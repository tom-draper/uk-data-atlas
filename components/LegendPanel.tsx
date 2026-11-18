"use client";

import { PARTIES } from "@uk-data-atlas/datasets";
import { themes } from "@/lib/helpers/colorScale";
import { categoryColor, isCategoryDataset } from "@/lib/datasets/categories";
import type { MapOptions } from "@/lib/types/mapOptions";
import {
	declaredDisplay as displayOf,
	declaredMeasure as measureOf,
} from "@/lib/datasets/declared";
import {} from "@/lib/config/mapOptions";
import type { ActiveViz, Dataset, Datasets, PartyCode } from "@/lib/types";
import type { BoundaryData } from "@uk-data-atlas/datasets";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import LegendContent from "./LegendContent";
import {
	categoryLegendItems,
	partyLegendItems,
	useLegendAggregates,
} from "./legend/legendData";
import {
	DeclaredMeasurePanel,
	ElectionMetricPanel,
	LifeExpectancyKindPanel,
	PercentageRangePanel,
} from "./legend/LegendSupplementalPanels";
import type { MapOptionsChangeHandler } from "./legend/types";
import { useLegendControls } from "./legend/useLegendControls";

interface LegendPanelProps {
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	mapOptions: MapOptions;
	onMapOptionsChange: MapOptionsChangeHandler;
	setActiveViz?: (viz: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
	datasets: Datasets;
}

export default function LegendPanel({
	activeDataset,
	activeViz,
	mapOptions,
	onMapOptionsChange,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
	datasets,
}: LegendPanelProps) {
	const controls = useLegendControls(
		activeDataset,
		mapOptions,
		onMapOptionsChange,
	);
	const declaredDisplay = activeDataset
		? displayOf(activeDataset.type)
		: undefined;
	const declaredMeasure = activeDataset
		? measureOf(activeDataset.type, controls.displayOptions)
		: undefined;
	const activeTheme =
		themes.find((theme) => theme.id === controls.displayOptions.theme.id) ??
		themes[0];
	const verticalThemeGradient = `linear-gradient(to bottom, ${activeTheme.colors.join(", ")})`;
	const overlayOpacity = Math.min(
		1,
		(controls.displayOptions.visibility.overlayOpacity ?? 1) + 0.2,
	);
	const aggregates = useLegendAggregates(
		datasets,
		mapManager,
		boundaryData,
		location,
	);
	const parties = partyLegendItems(activeDataset, aggregates);
	const categories = categoryLegendItems(activeDataset, aggregates);
	const isDark = useIsDark();
	const theme = panelTheme(isDark);
	const electionSupportsTurnout =
		(activeDataset?.type === "general-election" ||
			activeDataset?.type === "local-election") &&
		Object.values(activeDataset.data).some(
			({ turnoutPercent }) => turnoutPercent > 0,
		);

	if (
		!activeDataset ||
		((activeDataset.type === "general-election" ||
			activeDataset.type === "local-election") &&
			parties.length === 0) ||
		(isCategoryDataset(activeDataset.type) && categories.length === 0)
	) {
		return null;
	}

	return (
		<div className="pointer-events-none md:p-2.5 md:pr-0 flex flex-col h-full gap-2.5">
			<div
				className={`pointer-events-auto rounded-md w-fit ml-auto relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div
					className={`relative ${theme.section} p-1 overflow-hidden`}
					style={{ zIndex: 1 }}
				>
					<LegendContent
						activeDataset={activeDataset}
						activeViz={activeViz}
						displayOptions={controls.displayOptions}
						verticalThemeGradient={verticalThemeGradient}
						overlayOpacity={overlayOpacity}
						isDark={isDark}
						parties={parties}
						categories={categories}
						onRangeInput={controls.handleRangeInput}
						onRangeChangeEnd={controls.handleRangeChangeEnd}
						onPartyClick={(id) =>
							controls.handlePartyClick(id as PartyCode)
						}
						onPartyRightClick={(id) =>
							controls.handlePartyRightClick(id as PartyCode)
						}
						onCategoryClick={controls.handleCategoryClick}
						onCategoryRightClick={controls.handleCategoryRightClick}
						onPointLegendClick={controls.handlePointLegendClick}
						onPointLegendRightClick={
							controls.handlePointLegendRightClick
						}
						onNetworkClick={controls.handleNetworkClick}
						onNetworkRightClick={controls.handleNetworkRightClick}
					/>
				</div>
			</div>

			{activeDataset?.type === "life-expectancy" && setActiveViz && (
				<LifeExpectancyKindPanel
					kind={activeDataset.id === "hle" ? "hle" : "le"}
					onChange={(id) => {
						const dataset = datasets["life-expectancy"][id];
						if (dataset)
							setActiveViz({
								datasetId: dataset.id,
								datasetType: dataset.type,
								datasetYear: dataset.year,
								...(id === "hle"
									? { view: "healthy-life-expectancy" }
									: {}),
							});
					}}
				/>
			)}

			{declaredDisplay && declaredDisplay.measures.length > 1 && (
				<DeclaredMeasurePanel
					measure={declaredMeasure?.id ?? ""}
					measures={declaredDisplay.measures}
					onChange={(measure) =>
						onMapOptionsChange(
							activeDataset!.type as keyof MapOptions,
							{
								measure,
								colorRange: {
									...declaredDisplay.measures.find(
										(candidate) => candidate.id === measure,
									)!.colorRange,
								},
							},
						)
					}
				/>
			)}

			{electionSupportsTurnout &&
				controls.electionType &&
				controls.electionOptions && (
					<ElectionMetricPanel
						metric={controls.electionOptions.metric ?? "votes"}
						onChange={(metric) =>
							onMapOptionsChange(controls.electionType!, {
								metric,
							})
						}
					/>
				)}

			{(controls.showElectionPct || controls.showElectionTurnout) &&
				controls.electionType &&
				controls.electionOptions && (
					<PercentageRangePanel
						range={
							controls.showElectionTurnout
								? controls.electionTurnoutRange
								: controls.electionRange
						}
						gradient={
							controls.showElectionTurnout
								? verticalThemeGradient
								: `linear-gradient(to bottom, ${PARTIES[controls.electionOptions.selected as PartyCode]?.color || "#999"}, ${isDark ? "#1f2937" : "#f5f5f5"})`
						}
						opacity={overlayOpacity}
						onRangeInput={
							controls.showElectionTurnout
								? controls.handleElectionTurnoutRangeInput
								: controls.handleElectionRangeInput
						}
						onRangeChangeEnd={
							controls.showElectionTurnout
								? controls.handleElectionTurnoutRangeChangeEnd
								: controls.handleElectionRangeChangeEnd
						}
					/>
				)}

			{controls.categoryOptions?.mode === "percentage" && (
				<PercentageRangePanel
					range={controls.categoryRange}
					gradient={`linear-gradient(to bottom, ${categoryColor(activeDataset.type, controls.categoryOptions.selected ?? "")}, ${isDark ? "#1f2937" : "#f5f5f5"})`}
					opacity={overlayOpacity}
					onRangeInput={controls.handleCategoryRangeInput}
					onRangeChangeEnd={controls.handleCategoryRangeChangeEnd}
				/>
			)}
		</div>
	);
}
