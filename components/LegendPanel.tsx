"use client";

import { PARTIES } from "@uk-data-atlas/datasets";
import { ETHNICITY_COLORS, themes } from "@/lib/helpers/colorScale";
import type { MapOptions } from "@/lib/types/mapOptions";
import {
	declaredDisplay as displayOf,
	declaredMeasure as measureOf,
} from "@/lib/datasets/declared";
import {} from "@/lib/config/mapOptions";
import type {
	ActiveViz,
	Dataset,
	Datasets,
	EthnicityCode,
	PartyCode,
} from "@/lib/types";
import type { BoundaryData } from "@uk-data-atlas/datasets";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import LegendContent from "./LegendContent";
import {
	ethnicityLegendItems,
	partyLegendItems,
	useLegendAggregates,
} from "./legend/legendData";
import {
	DeclaredMeasurePanel,
	ElectionMetricPanel,
	FuelPovertyMeasurePanel,
	HousePriceMeasurePanel,
	LifeExpectancyMeasurePanel,
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
	const ethnicities = ethnicityLegendItems(activeDataset, aggregates);
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
		(activeDataset.type === "ethnicity" && ethnicities.length === 0)
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
						ethnicities={ethnicities}
						onRangeInput={controls.handleRangeInput}
						onRangeChangeEnd={controls.handleRangeChangeEnd}
						onPartyClick={(id) =>
							controls.handlePartyClick(id as PartyCode)
						}
						onPartyRightClick={(id) =>
							controls.handlePartyRightClick(id as PartyCode)
						}
						onEthnicityClick={(id) =>
							controls.handleEthnicityClick(id as EthnicityCode)
						}
						onEthnicityRightClick={(id) =>
							controls.handleEthnicityRightClick(
								id as EthnicityCode,
							)
						}
						onPointLegendClick={controls.handlePointLegendClick}
						onPointLegendRightClick={
							controls.handlePointLegendRightClick
						}
						onNetworkClick={controls.handleNetworkClick}
						onNetworkRightClick={controls.handleNetworkRightClick}
					/>
				</div>
			</div>

			{activeDataset?.type === "fuelPoverty" && (
				<FuelPovertyMeasurePanel
					measure={controls.displayOptions.fuelPoverty.measure}
					onChange={(measure) =>
						onMapOptionsChange("fuelPoverty", {
							measure,
							colorRange:
								measure === "rate"
									? { min: 5, max: 15 }
									: { min: 0, max: 300 },
						})
					}
				/>
			)}
			{activeDataset?.type === "lifeExpectancy" && setActiveViz && (
				<LifeExpectancyKindPanel
					kind={activeDataset.id === "hle" ? "hle" : "le"}
					onChange={(id) => {
						const dataset = datasets.lifeExpectancy[id];
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
			{activeDataset?.type === "housePrice" && (
				<HousePriceMeasurePanel
					measure={controls.displayOptions.housePrice.measure}
					onChange={(measure) =>
						onMapOptionsChange("housePrice", { measure })
					}
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

			{activeDataset?.type === "lifeExpectancy" && (
				<LifeExpectancyMeasurePanel
					measure={controls.displayOptions.lifeExpectancy.measure}
					onChange={(measure) =>
						onMapOptionsChange("lifeExpectancy", { measure })
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

			{controls.showEthnicityPct && (
				<PercentageRangePanel
					range={controls.ethnicityRange}
					gradient={`linear-gradient(to bottom, ${ETHNICITY_COLORS[controls.displayOptions.ethnicity.selected as EthnicityCode] || "#999"}, ${isDark ? "#1f2937" : "#f5f5f5"})`}
					opacity={overlayOpacity}
					onRangeInput={controls.handleEthnicityRangeInput}
					onRangeChangeEnd={controls.handleEthnicityRangeChangeEnd}
				/>
			)}
		</div>
	);
}
