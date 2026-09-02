"use client";
import { useMemo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import QualificationChart from "./QualificationChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import ScalarChartCards, { hasVisibleScalarChart } from "@/components/ScalarChartCards";

interface EducationSectionProps {
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

export default function EducationSection({
	activeDataset,
	datasets,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: EducationSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showQualifications = visibility["education-qualifications"];
	const showScalarCharts = hasVisibleScalarChart("Education", visibility);
	const availableQualificationDatasets = datasets.qualification;

	const aggregatedQualificationData = useMemo(
		() => aggregateDataset({ datasets: availableQualificationDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateQualificationStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[availableQualificationDatasets, mapManager, boundaryData, location],
	);
	if (!showQualifications && !showScalarCharts) return null;

	const qualYears = Object.keys(availableQualificationDatasets).map(Number).sort((a, b) => b - a);

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Education
			</h3>
			{showQualifications && qualYears.map((year) => (
				<QualificationChart
					key={year}
					activeDataset={activeDataset}
					availableDatasets={availableQualificationDatasets}
					aggregatedData={aggregatedQualificationData}
					selectedArea={selectedArea}
					year={year}
					setActiveViz={setActiveViz}
				/>
			))}
			<ScalarChartCards group="Education" visibility={visibility} activeDataset={activeDataset} datasets={datasets} selectedArea={selectedArea} codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} mapManager={mapManager} boundaryData={boundaryData} location={location} />
		</div>
	);
}
