"use client";
import { useMemo } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { ActiveViz } from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import { gazetteer } from "@/lib/data/gazetteer/static";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";
import { rgbToHex } from "@/lib/helpers/colorScale/interpolation";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";

const SEVERITY_COLORS = [
	[250, 204, 21], // Slight
	[249, 115, 22], // Serious
	[153, 27, 27], // Fatal
] as const;

function severityColor(averageSeverity: number): string {
	const position = Math.max(0, Math.min(1, (averageSeverity - 1) / 2));
	const segment = position <= 0.5 ? 0 : 1;
	const localPosition = (position - segment * 0.5) * 2;
	const from = SEVERITY_COLORS[segment];
	const to = SEVERITY_COLORS[segment + 1];
	return rgbToHex(
		from[0] + (to[0] - from[0]) * localPosition,
		from[1] + (to[1] - from[1]) * localPosition,
		from[2] + (to[2] - from[2]) * localPosition,
	);
}

function RoadSafetyCard({
	dataset,
	isActive,
	setActiveViz,
	location,
}: {
	dataset: CustomDataset;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
}) {
	const isDark = useIsDark();
	const { excludedPointValues, selectedPointValue } = useExcludedCategories();
	const points = useMemo(() => {
		const locationPoints = getPointsInBounds(
			dataset.points ?? [],
			gazetteer.boundsOf(location),
		);
		if (!isActive) return locationPoints;
		return locationPoints.filter(
			(point) =>
				!excludedPointValues.has(point.value) &&
				(selectedPointValue === undefined || point.value === selectedPointValue),
		);
	}, [
		dataset.points,
		location,
		isActive,
		excludedPointValues,
		selectedPointValue,
	]);
	const hasData = points.length > 0;
	const averageSeverity = hasData
		? points.reduce((total, point) => total + point.value, 0) / points.length
		: 0;
	const severityBarWidth = (averageSeverity / 3) * 100;
	const accent = hasData ? severityColor(averageSeverity) : null;
	return (
		<ChartCard
			heading={dataset.dataColumn}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					Great Britain
				</span>
			}
			accent={accent}
			isActive={isActive}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: "custom",
					datasetYear: 0,
				})
			}
			title="Department for Transport. Provisional road collision statistics for Great Britain, 2025."
		>
			<ChartCardValueBar
				hasData={hasData}
				value={points.length.toLocaleString("en-GB")}
				unit="collisions"
				secondary={`severity ${averageSeverity.toFixed(1)} / 3`}
				barWidth={severityBarWidth}
				barColor={accent ?? undefined}
			/>
		</ChartCard>
	);
}

export default function TransportSection({
	roadSafetyDatasets,
	activeViz,
	setActiveViz,
	location,
}: {
	roadSafetyDatasets: CustomDataset[];
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
}) {
	const isDark = useIsDark();

	if (roadSafetyDatasets.length === 0) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				Transport
			</h3>
			<div className="space-y-2">
				{roadSafetyDatasets.map((ds) => (
					<RoadSafetyCard
						key={ds.id}
						dataset={ds}
						isActive={
							activeViz.datasetType === "custom" &&
							activeViz.vizId === ds.id
						}
						setActiveViz={setActiveViz}
						location={location}
					/>
				))}
			</div>
		</div>
	);
}
