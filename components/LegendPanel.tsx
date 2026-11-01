"use client";

import { PARTIES } from "@uk-data-atlas/datasets/data/election/parties";
import { ETHNICITY_COLORS, themes } from "@/lib/helpers/colorScale";
import type { MapOptions } from "@/lib/types/mapOptions";
import {
	hasPopulationMetric,
	POPULATION_METRIC_RANGES,
} from "@/lib/config/mapOptions";
import type {
	ActiveViz,
	Dataset,
	Datasets,
	EthnicityCode,
	PartyCode,
} from "@/lib/types";
import type { BoundaryData } from "@uk-data-atlas/datasets/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import { imdRange } from "@/lib/helpers/imdMeasures";
import GlassOverlays from "./GlassOverlays";
import LegendContent from "./LegendContent";
import {
	ethnicityLegendItems,
	partyLegendItems,
	useLegendAggregates,
} from "./legend/legendData";
import {
	AirQualityMeasurePanel,
	ClaimantCountMeasurePanel,
	BroadbandMeasurePanel,
	CountMetricPanel,
	ElectionMetricPanel,
	EnergySectorPanel,
	GhgEmissionsMeasurePanel,
	FuelPovertyMeasurePanel,
	HomelessnessMeasurePanel,
	HousePriceMeasurePanel,
	HousingTenureMeasurePanel,
	GeneralHealthMeasurePanel,
	IncomeMeasurePanel,
	IncomePeriodPanel,
	ImdMeasurePanel,
	PlanningMeasurePanel,
	PupilAbsenceMeasurePanel,
	PublicHealthMeasurePanel,
	WorkplacePayMeasurePanel,
	LifeExpectancyMeasurePanel,
	LifeExpectancyKindPanel,
	MobileCoverageMeasurePanel,
	PercentageRangePanel,
	RegionalOutputMeasurePanel,
	SchoolPerformanceMeasurePanel,
	UnemploymentMeasurePanel,
	WasteMetricPanel,
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
		(activeDataset?.type === "generalElection" ||
			activeDataset?.type === "localElection") &&
		Object.values(activeDataset.data).some(
			({ turnoutPercent }) => turnoutPercent > 0,
		);
	const countMetricDataset =
		activeDataset && hasPopulationMetric(activeDataset.type)
			? activeDataset.type
			: null;

	if (
		!activeDataset ||
		((activeDataset.type === "generalElection" ||
			activeDataset.type === "localElection") &&
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

			{activeDataset?.type === "publicHealth" && (
				<PublicHealthMeasurePanel
					measure={controls.displayOptions.publicHealth.measure}
					onChange={(measure) =>
						onMapOptionsChange("publicHealth", {
							measure,
							colorRange:
								measure === "preventableMortality"
									? { min: 0, max: 400 }
									: { min: 0, max: 100 },
						})
					}
				/>
			)}
			{activeDataset?.type === "pupilAbsence" && (
				<PupilAbsenceMeasurePanel
					measure={controls.displayOptions.pupilAbsence.measure}
					onChange={(measure) =>
						onMapOptionsChange("pupilAbsence", {
							measure,
							colorRange: { min: 0, max: 30 },
						})
					}
				/>
			)}
			{activeDataset?.type === "regionalGdpItl3" && (
				<RegionalOutputMeasurePanel
					measure={controls.displayOptions.regionalGdpItl3.measure}
					onChange={(measure) =>
						onMapOptionsChange("regionalGdpItl3", {
							measure,
							colorRange: { min: 0, max: 50_000 },
						})
					}
				/>
			)}
			{activeDataset?.type === "workplaceIncome" && (
				<WorkplacePayMeasurePanel
					measure={controls.displayOptions.workplaceIncome.measure}
					onChange={(measure) =>
						onMapOptionsChange("workplaceIncome", {
							measure,
							colorRange: measure.startsWith("hourly")
								? { min: 10, max: 30 }
								: { min: 25000, max: 45000 },
						})
					}
				/>
			)}
			{activeDataset?.type === "planningApplications" && (
				<PlanningMeasurePanel
					measure={
						controls.displayOptions.planningApplications.measure
					}
					onChange={(measure) =>
						onMapOptionsChange("planningApplications", {
							measure,
							colorRange: { min: 0, max: 1500 },
						})
					}
				/>
			)}
			{activeDataset?.type === "imd" && (
				<ImdMeasurePanel
					measure={controls.displayOptions.imd.measure}
					onChange={(measure) =>
						onMapOptionsChange("imd", {
							measure,
							colorRange: imdRange(measure),
						})
					}
				/>
			)}
			{activeDataset?.type === "income" && (
				<IncomePeriodPanel
					period={controls.displayOptions.income.period}
					onChange={(period) =>
						onMapOptionsChange("income", {
							period,
							colorRange:
								period === "annual"
									? { min: 25000, max: 45000 }
									: { min: 10, max: 30 },
						})
					}
				/>
			)}
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
			{activeDataset?.type === "ghgEmissions" && (
				<GhgEmissionsMeasurePanel
					measure={controls.displayOptions.ghgEmissions.measure}
					onChange={(measure) =>
						onMapOptionsChange("ghgEmissions", {
							measure,
							colorRange:
								measure === "perPerson"
									? { min: 3, max: 12 }
									: measure === "landUse"
										? { min: -500, max: 500 }
										: { min: 0, max: 2500 },
						})
					}
				/>
			)}
			{activeDataset?.type === "mobileCoverage" && (
				<MobileCoverageMeasurePanel
					measure={controls.displayOptions.mobileCoverage.measure}
					onChange={(measure) =>
						onMapOptionsChange("mobileCoverage", {
							measure,
							colorRange: { min: 0, max: 100 },
						})
					}
				/>
			)}
			{activeDataset?.type === "generalHealth" && (
				<GeneralHealthMeasurePanel
					measure={controls.displayOptions.generalHealth.measure}
					onChange={(measure) =>
						onMapOptionsChange("generalHealth", {
							measure,
							colorRange: { min: 0, max: 100 },
						})
					}
				/>
			)}
			{activeDataset?.type === "housingTenure" && (
				<HousingTenureMeasurePanel
					measure={controls.displayOptions.housingTenure.measure}
					onChange={(measure) =>
						onMapOptionsChange("housingTenure", {
							measure,
							colorRange: { min: 0, max: 100 },
						})
					}
				/>
			)}
			{activeDataset?.type === "electricityConsumption" && (
				<EnergySectorPanel
					sector={
						controls.displayOptions.electricityConsumption.sector
					}
					onChange={(sector) =>
						onMapOptionsChange("electricityConsumption", { sector })
					}
				/>
			)}
			{activeDataset?.type === "gasConsumption" && (
				<EnergySectorPanel
					sector={controls.displayOptions.gasConsumption.sector}
					onChange={(sector) =>
						onMapOptionsChange("gasConsumption", { sector })
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

			{activeDataset?.type === "income" && (
				<IncomeMeasurePanel
					measure={controls.displayOptions.income.measure}
					onChange={(measure) =>
						onMapOptionsChange("income", { measure })
					}
				/>
			)}

			{activeDataset?.type === "airQuality" && (
				<AirQualityMeasurePanel
					measure={controls.displayOptions.airQuality.measure}
					onChange={(measure) =>
						onMapOptionsChange("airQuality", {
							measure,
							colorRange:
								measure === "pm25"
									? { min: 4, max: 12 }
									: measure === "pm10"
										? { min: 8, max: 25 }
										: { min: 2, max: 20 },
						})
					}
				/>
			)}

			{activeDataset?.type === "unemployment" && (
				<UnemploymentMeasurePanel
					measure={controls.displayOptions.unemployment.measure}
					onChange={(measure) =>
						onMapOptionsChange("unemployment", {
							measure,
							colorRange:
								measure === "count"
									? { min: 1000, max: 11000 }
									: { min: 2.2, max: 6.8 },
						})
					}
				/>
			)}

			{activeDataset?.type === "claimantCount" && (
				<ClaimantCountMeasurePanel
					measure={controls.displayOptions.claimantCount.measure}
					onChange={(measure) =>
						onMapOptionsChange("claimantCount", {
							measure,
							colorRange:
								measure === "count"
									? { min: 1000, max: 14000 }
									: { min: 1, max: 8 },
						})
					}
				/>
			)}

			{activeDataset?.type === "homelessness" && (
				<HomelessnessMeasurePanel
					measure={controls.displayOptions.homelessness.measure}
					onChange={(measure) =>
						onMapOptionsChange("homelessness", {
							measure,
							colorRange:
								measure === "count"
									? { min: 10, max: 2500 }
									: { min: 1, max: 12 },
						})
					}
				/>
			)}

			{activeDataset?.type === "schoolPerformance" && (
				<SchoolPerformanceMeasurePanel
					measure={controls.displayOptions.schoolPerformance.measure}
					onChange={(measure) =>
						onMapOptionsChange("schoolPerformance", {
							measure,
							colorRange:
								measure === "attainment8"
									? { min: 35, max: 60 }
									: measure === "progress8"
										? { min: -0.5, max: 0.5 }
										: { min: 50, max: 80 },
						})
					}
				/>
			)}

			{activeDataset?.type === "waste" && (
				<WasteMetricPanel
					metric={controls.displayOptions.waste.metric}
					onChange={(metric) =>
						onMapOptionsChange("waste", {
							metric,
							colorRange:
								metric === "recyclingShare"
									? { min: 0, max: 100 }
									: POPULATION_METRIC_RANGES.waste[
											controls.displayOptions.waste
												.measure
										],
						})
					}
				/>
			)}

			{countMetricDataset &&
				!(
					countMetricDataset === "waste" &&
					controls.displayOptions.waste.metric === "recyclingShare"
				) && (
					<CountMetricPanel
						measure={
							controls.displayOptions[countMetricDataset].measure
						}
						onChange={(measure) => {
							const colorRange =
								POPULATION_METRIC_RANGES[countMetricDataset][
									measure
								];
							onMapOptionsChange(countMetricDataset, {
								measure,
								colorRange,
							});
						}}
					/>
				)}

			{activeDataset?.type === "broadband" && (
				<BroadbandMeasurePanel
					measure={controls.displayOptions.broadband.measure}
					onChange={(measure) =>
						onMapOptionsChange("broadband", {
							measure,
							colorRange:
								measure === "superfast"
									? { min: 70, max: 100 }
									: measure === "ultrafast"
										? { min: 30, max: 100 }
										: { min: 50, max: 100 },
						})
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
