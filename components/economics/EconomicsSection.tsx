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
import ChildPovertyChart from "./child-poverty/ChildPovertyChart";
import HomelessnessChart from "./homelessness/HomelessnessChart";
import FuelPovertyChart from "./fuel-poverty/FuelPovertyChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

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
	const showChildPoverty = visibility["economics-childPoverty"];
	const showHomelessness = visibility["economics-homelessness"];
	const showFuelPoverty = visibility["economics-fuelPoverty"];

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
	const aggregatedChildPovertyData = useMemo(
		() => aggregateDataset({ datasets: datasets.childPoverty, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateChildPovertyStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.childPoverty, mapManager, boundaryData, location],
	);
	const aggregatedHomelessnessData = useMemo(
		() => aggregateDataset({ datasets: datasets.homelessness, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateHomelessnessStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.homelessness, mapManager, boundaryData, location],
	);
	const aggregatedFuelPovertyData = useMemo(
		() => aggregateDataset({ datasets: datasets.fuelPoverty, boundaryType: "lsoa", calculateStats: (mm, g, d, loc, id) => mm.calculateFuelPovertyStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[datasets.fuelPoverty, mapManager, boundaryData, location],
	);

	if (!showHousePrice && !showIncome && !showCrime && !showClaimantCount && !showUnemployment && !showChildPoverty && !showHomelessness && !showFuelPoverty) return null;

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
			{showChildPoverty && (
				<ChildPovertyChart activeDataset={activeDataset} availableDatasets={datasets.childPoverty}
					aggregatedData={aggregatedChildPovertyData} year={2025} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showHomelessness && (
				<HomelessnessChart activeDataset={activeDataset} availableDatasets={datasets.homelessness}
					aggregatedData={aggregatedHomelessnessData} year={2026} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showFuelPoverty && (
				<FuelPovertyChart activeDataset={activeDataset} availableDatasets={datasets.fuelPoverty}
					aggregatedData={aggregatedFuelPovertyData} selectedArea={selectedArea}
					activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
		</div>
	);
}
