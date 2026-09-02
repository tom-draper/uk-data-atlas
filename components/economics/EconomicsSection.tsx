"use client";
import { useMemo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import HousePriceChart from "./house-price/HousePriceChart";
import IncomeChart from "./income/IncomeChart";
import CrimeRateChart from "./crime/CrimeRateChart";
import ClaimantCountChart from "./claimant-count/ClaimantCountChart";
import UnemploymentChart from "./unemployment/UnemploymentChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { SCALAR_DATASET_DEFINITIONS } from "@/lib/datasets";
import { SCALAR_CHART_COMPONENTS } from "@/lib/datasets/generatedCharts";

const ECONOMICS_SCALAR_DEFINITIONS = SCALAR_DATASET_DEFINITIONS.filter(
	(definition) => definition.chart.group === "Economics",
);

interface EconomicsSectionProps {
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function EconomicsSection({
	activeDataset,
	datasets,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: EconomicsSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showHousePrice = visibility["economics-housePrice"];
	const showIncome = visibility["economics-income"];
	const showCrime = visibility["economics-crime"];
	const showClaimantCount = visibility["economics-claimantCount"];
	const showUnemployment = visibility["economics-unemployment"];

	const aggregatedHousePriceData = useMemo(
		() => aggregateDataset({ datasets: datasets.housePrice, boundaryType: "ward", calculateStats: (mm, g, d, loc, id) => mm.calculateHousePriceStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.housePrice, mapManager, boundaryData, location],
	);
	const aggregatedIncomeData = useMemo(
		() => aggregateDataset({ datasets: datasets.income, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateIncomeStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.income, mapManager, boundaryData, location],
	);
	const aggregatedCrimeData = useMemo(
		() => aggregateDataset({ datasets: datasets.crime, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateCrimeStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.crime, mapManager, boundaryData, location],
	);
	const aggregatedClaimantCountData = useMemo(
		() => aggregateDataset({ datasets: datasets.claimantCount, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateClaimantCountStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.claimantCount, mapManager, boundaryData, location],
	);
	const aggregatedUnemploymentData = useMemo(
		() => aggregateDataset(
			{
				datasets: datasets.unemployment,
				boundaryType: "localAuthority",
				keyBy: "id",
				calculateStats: (mm, g, _d, loc, id) => {
					const ds = datasets.unemployment[id];
					return ds ? mm.calculateUnemploymentStats(g, ds, loc, id) : null;
				},
			},
			mapManager, boundaryData, location,
		),
		[datasets.unemployment, mapManager, boundaryData, location],
	);
	const aggregatedScalarData = useMemo(
		() => Object.fromEntries(
			ECONOMICS_SCALAR_DEFINITIONS.map((definition) => [
				definition.type,
				aggregateDataset<any>(
					{
						datasets: datasets[definition.type],
						boundaryType: definition.chart.boundaryType,
						calculateStats: definition.chart.calculateStats,
					},
					mapManager,
					boundaryData,
					location,
				),
			]),
		),
		[
			mapManager,
			boundaryData,
			location,
			...ECONOMICS_SCALAR_DEFINITIONS.map((definition) => datasets[definition.type]),
		],
	);
	const hasVisibleScalarChart = ECONOMICS_SCALAR_DEFINITIONS.some(
		(definition) => visibility[definition.chart.key],
	);

	if (!showHousePrice && !showIncome && !showCrime && !showClaimantCount && !showUnemployment && !hasVisibleScalarChart) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Economics
			</h3>
			{showHousePrice && (
				<HousePriceChart activeDataset={activeDataset} availableDatasets={datasets.housePrice}
					aggregatedData={aggregatedHousePriceData} year={2023} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showIncome && (
				<IncomeChart activeDataset={activeDataset} availableDatasets={datasets.income}
					aggregatedData={aggregatedIncomeData} year={2025} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showCrime && (
				<CrimeRateChart activeDataset={activeDataset} availableDatasets={datasets.crime}
					aggregatedData={aggregatedCrimeData} year={2025} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showClaimantCount && (
				<ClaimantCountChart activeDataset={activeDataset} availableDatasets={datasets.claimantCount}
					aggregatedData={aggregatedClaimantCountData} year={2026} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showUnemployment && (
				<UnemploymentChart activeDataset={activeDataset} availableDatasets={datasets.unemployment}
					aggregatedData={aggregatedUnemploymentData} year={2021} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{ECONOMICS_SCALAR_DEFINITIONS.map((definition) => {
				if (!visibility[definition.chart.key]) return null;
				const Chart = SCALAR_CHART_COMPONENTS[definition.type];
				return (
					<Chart
						key={definition.type}
						activeDataset={activeDataset}
						availableDatasets={datasets[definition.type]}
						aggregatedData={aggregatedScalarData[definition.type]}
						year={definition.chart.year}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				);
			})}
		</div>
	);
}
