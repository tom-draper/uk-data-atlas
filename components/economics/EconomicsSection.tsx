"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, ClaimantCountDataset, CrimeDataset, Dataset, HousePriceDataset, IncomeDataset, SelectedArea, UnemploymentDataset } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import HousePriceChart from "./house-price/HousePriceChart";
import IncomeChart from "./income/IncomeChart";
import CrimeRateChart from "./crime/CrimeRateChart";
import ClaimantCountChart from "./claimant-count/ClaimantCountChart";
import UnemploymentChart from "./unemployment/UnemploymentChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface EconomicsSectionProps {
	activeDataset: Dataset | null;
	availableHousePriceDatasets: Record<string, HousePriceDataset>;
	availableIncomeDatasets: Record<string, IncomeDataset>;
	availableCrimeDatasets: Record<string, CrimeDataset>;
	availableClaimantCountDatasets: Record<string, ClaimantCountDataset>;
	availableUnemploymentDatasets: Record<string, UnemploymentDataset>;
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
	availableHousePriceDatasets,
	availableIncomeDatasets,
	availableCrimeDatasets,
	availableClaimantCountDatasets,
	availableUnemploymentDatasets,
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

	if (!showHousePrice && !showIncome && !showCrime && !showClaimantCount && !showUnemployment) return null;

	const aggregatedHousePriceData = aggregateDataset(
		{ datasets: availableHousePriceDatasets, boundaryType: "ward", calculateStats: (mm, g, d, loc, id) => mm.calculateHousePriceStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);
	const aggregatedIncomeData = aggregateDataset(
		{ datasets: availableIncomeDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateIncomeStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);
	const aggregatedCrimeData = aggregateDataset(
		{ datasets: availableCrimeDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateCrimeStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);
	const aggregatedClaimantCountData = aggregateDataset(
		{ datasets: availableClaimantCountDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateClaimantCountStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);
	const aggregatedUnemploymentData = aggregateDataset(
		{
			datasets: availableUnemploymentDatasets,
			boundaryType: "localAuthority",
			keyBy: "id",
			calculateStats: (mm, g, _d, loc, id) => {
				const ds = availableUnemploymentDatasets[id];
				return ds ? mm.calculateUnemploymentStats(g, ds, loc, id) : null;
			},
		},
		mapManager, boundaryData, location,
	);

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Economics
			</h3>
			{showHousePrice && (
				<HousePriceChart activeDataset={activeDataset} availableDatasets={availableHousePriceDatasets}
					aggregatedData={aggregatedHousePriceData} year={2023} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showIncome && (
				<IncomeChart activeDataset={activeDataset} availableDatasets={availableIncomeDatasets}
					aggregatedData={aggregatedIncomeData} year={2025} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showCrime && (
				<CrimeRateChart activeDataset={activeDataset} availableDatasets={availableCrimeDatasets}
					aggregatedData={aggregatedCrimeData} year={2025} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showClaimantCount && (
				<ClaimantCountChart activeDataset={activeDataset} availableDatasets={availableClaimantCountDatasets}
					aggregatedData={aggregatedClaimantCountData} year={2026} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
			{showUnemployment && (
				<UnemploymentChart activeDataset={activeDataset} availableDatasets={availableUnemploymentDatasets}
					aggregatedData={aggregatedUnemploymentData} year={2021} selectedArea={selectedArea}
					codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />
			)}
		</div>
	);
}
