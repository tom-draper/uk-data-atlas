"use client";
import { memo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedQualificationData,
	Dataset,
	QualificationDataset,
	SelectedArea,
} from "@lib/types";
import QualificationChart from "./QualificationChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface EducationSectionProps {
	activeDataset: Dataset | null;
	availableQualificationDatasets: Record<string, QualificationDataset>;
	aggregatedQualificationData: Record<number, AggregatedQualificationData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function EducationSection({
	activeDataset,
	availableQualificationDatasets,
	aggregatedQualificationData,
	selectedArea,
	setActiveViz,
}: EducationSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showQualifications = visibility["education-qualifications"];

	const qualYears = Object.keys(availableQualificationDatasets).map(Number).sort((a, b) => b - a);

	if (!showQualifications) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>Education</h3>
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
		</div>
	);
});
