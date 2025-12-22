"use client";

import {
	ActiveViz,
	EthnicityDataset,
	SelectedArea,
	EthnicityCategory,
	AggregatedEthnicityData,
} from "@/lib/types";
import { ETHNICITY_COLORS } from "@/lib/helpers/colorScale";
import { useMemo, memo } from "react";

const YEAR_STYLES = {
	bg: "bg-indigo-50/60",
	border: "border-indigo-300",
};

interface ProcessedEthnicityData {
	ethnicity: string;
	color: string;
	population: number;
	percentage: number;
	parentCategory: string;
}

const EthnicityBar = memo(({ data }: { data: ProcessedEthnicityData[] }) => (
	<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
		{data.map((item, idx) => (
			<div
				key={`${item.parentCategory}-${item.ethnicity}-${idx}`}
				style={{
					width: `${item.percentage}%`,
					backgroundColor: item.color,
				}}
				title={`${item.ethnicity}: ${item.population.toLocaleString()} (${item.percentage.toFixed(1)}%)`}
				className="group relative hover:opacity-80 transition-opacity"
			>
				{item.percentage > 5 && (
					<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
						{item.percentage.toFixed(0)}%
					</span>
				)}
			</div>
		))}
	</div>
));
EthnicityBar.displayName = "EthnicityBar";

const Legend = memo(
	({ ethnicityData }: { ethnicityData: ProcessedEthnicityData[] }) => (
		<div className="animate-in fade-in duration-200 mt-1">
			<div className="grid grid-cols-3 gap-0.5 text-[9px] overflow-y-auto">
				{ethnicityData.map((item, idx) => (
					<div
						key={`${item.parentCategory}-${item.ethnicity}-${idx}`}
						className="flex items-center gap-1 min-w-0"
					>
						<div
							className="w-1.5 h-1.5 rounded-sm shrink-0"
							style={{ backgroundColor: item.color }}
						/>
						<span
							className="truncate font-medium"
							title={item.ethnicity}
						>
							{item.population.toLocaleString()}: {item.ethnicity}
						</span>
					</div>
				))}
			</div>
		</div>
	),
);
Legend.displayName = "Legend";

interface EthnicityChartProps {
	dataset: EthnicityDataset;
	aggregatedData: AggregatedEthnicityData | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "localAuthority",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

// Helper function to flatten ethnicity data structure
function flattenEthnicityData(
	areaData: Record<string, EthnicityCategory>,
): ProcessedEthnicityData[] {
	const allEthnicities: ProcessedEthnicityData[] = [];

	for (const [parentCategory, subcategories] of Object.entries(areaData)) {
		for (const ethnicity of Object.values(subcategories)) {
			allEthnicities.push({
				ethnicity: ethnicity.ethnicity,
				color: ETHNICITY_COLORS[ethnicity.ethnicity] || "#6b7280",
				population: ethnicity.population,
				percentage: 0,
				parentCategory,
			});
		}
	}

	return allEthnicities;
}

export default memo(function EthnicityChart({
	dataset,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
}: EthnicityChartProps) {
	const vizId = dataset.id;
	const isActive = activeViz.vizId === vizId;

	const processedData = useMemo(() => {
		// Determine which data to use
		const areaData = selectedArea?.code
			? dataset.data[selectedArea.code]
			: aggregatedData?.[2021];

		if (!areaData) {
			return { hasData: false, ethnicityData: [], totalPopulation: 0 };
		}

		// Flatten the nested structure
		const allEthnicities = flattenEthnicityData(areaData);

		const totalPopulation = allEthnicities.reduce(
			(sum, item) => sum + item.population,
			0,
		);

		if (totalPopulation === 0) {
			return { hasData: false, ethnicityData: [], totalPopulation: 0 };
		}

		// Calculate percentages and sort by population (descending)
		const ethnicityData = allEthnicities
			.map((item) => ({
				...item,
				percentage: (item.population / totalPopulation) * 100,
			}))
			.sort((a, b) => b.population - a.population);

		return { hasData: true, ethnicityData, totalPopulation };
	}, [dataset, selectedArea, aggregatedData]);

	const heightClass = isActive ? "h-[170px]" : "h-[65px]";

	const handleActivate = () => {
		setActiveViz({
			vizId: dataset.id,
			datasetType: dataset.type,
			datasetYear: dataset.year,
		});
	};

	return (
		<div
			className={`
                p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden border-2 
                ${heightClass}
                ${isActive ? `${YEAR_STYLES.bg} ${YEAR_STYLES.border}` : "bg-white/60 border-gray-200/80 hover:border-indigo-300"}
            `}
			onClick={handleActivate}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">
					Ethnicity [{dataset.year}]
				</h3>
			</div>

			{!processedData.hasData ? (
				<div className="text-xs text-gray-400/80 pt-0.5 text-center">
					No data available
				</div>
			) : (
				<div className="space-y-1">
					<EthnicityBar data={processedData.ethnicityData} />
					{isActive && (
						<Legend ethnicityData={processedData.ethnicityData} />
					)}
				</div>
			)}
		</div>
	);
});
