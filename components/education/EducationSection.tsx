"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, QualificationDataset, SchoolPerformanceDataset, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import QualificationChart from "./QualificationChart";
import SchoolPerformanceChart from "./SchoolPerformanceChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface EducationSectionProps {
	activeDataset: Dataset | null;
	availableQualificationDatasets: Record<string, QualificationDataset>;
	availableSchoolPerformanceDatasets: Record<string, SchoolPerformanceDataset>;
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
	availableQualificationDatasets,
	availableSchoolPerformanceDatasets,
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
	const showSchoolPerformance = visibility["education-schoolPerformance"];

	if (!showQualifications && !showSchoolPerformance) return null;

	const aggregatedQualificationData = aggregateDataset(
		{
			datasets: availableQualificationDatasets,
			boundaryType: "localAuthority",
			calculateStats: (mm, g, d, loc, id) => mm.calculateQualificationStats(g, d, loc, id),
		},
		mapManager,
		boundaryData,
		location,
	);

	const aggregatedSchoolPerformanceData = aggregateDataset(
		{
			datasets: availableSchoolPerformanceDatasets,
			boundaryType: "localAuthority",
			calculateStats: (mm, g, d, loc, id) => mm.calculateSchoolPerformanceStats(g, d, loc, id),
		},
		mapManager,
		boundaryData,
		location,
	);

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
			{showSchoolPerformance && (
				<SchoolPerformanceChart
					activeDataset={activeDataset}
					availableDatasets={availableSchoolPerformanceDatasets}
					aggregatedData={aggregatedSchoolPerformanceData}
					selectedArea={selectedArea}
					year={2024}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
		</div>
	);
}
