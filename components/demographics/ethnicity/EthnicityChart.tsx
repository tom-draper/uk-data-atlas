"use client";

import {
	ActiveViz,
	EthnicityDataset,
	SelectedArea,
	EthnicityCategory,
	AggregatedEthnicityData,
} from "@/lib/types";
import { ETHNICITY_COLORS } from "@/lib/helpers/colorScale";
import { useMemo, memo, useState } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { hexToRgb, lightenHex } from "@/lib/helpers/colorScale/interpolation";

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
	aggregatedData: Record<number, AggregatedEthnicityData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

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
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const [hovered, setHovered] = useState(false);
	const vizId = dataset.id;
	const isActive = activeViz.vizId === vizId;

	const processedData = useMemo(() => {
		const areaData = selectedArea?.code
			? dataset.data[selectedArea.code]
			: aggregatedData?.[2021];

		if (!areaData) {
			return { hasData: false, ethnicityData: [], totalPopulation: 0 };
		}

		const allEthnicities = flattenEthnicityData(areaData);

		const totalPopulation = allEthnicities.reduce(
			(sum, item) => sum + item.population,
			0,
		);

		if (totalPopulation === 0) {
			return { hasData: false, ethnicityData: [], totalPopulation: 0 };
		}

		const ethnicityData = allEthnicities
			.map((item) => ({
				...item,
				percentage: (item.population / totalPopulation) * 100,
			}))
			.sort((a, b) => b.population - a.population);

		return { hasData: true, ethnicityData, totalPopulation };
	}, [dataset, selectedArea, aggregatedData]);

	const heightClass = isActive ? "h-[170px]" : "h-[65px]";

	const accentColor = processedData.ethnicityData[0]?.color ?? null;

	const dynamicStyle: React.CSSProperties = (() => {
		if (!accentColor || (!isActive && !hovered)) return {};
		const style: React.CSSProperties = { borderColor: lightenHex(accentColor, 0.45) };
		if (isActive) {
			const rgb = hexToRgb(accentColor);
			style.backgroundColor = isDark
				? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
				: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`;
		}
		return style;
	})();

	return (
		<div
			style={dynamicStyle}
			className={`
                p-2 rounded transition-[height] duration-300 ease-in-out cursor-pointer overflow-hidden relative border-2
                ${heightClass}
                ${isActive
					? isDark ? "bg-white/10" : "bg-white/60"
					: isDark ? "bg-white/5 border-white/10" : "bg-white/60 border-gray-200/80"
				}
            `}
			title="Office for National Statistics. Census 2021: Ethnic Group, England and Wales. ons.gov.uk"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">
					Ethnicity [{dataset.year}]
				</h3>
			</div>

			{!processedData.hasData ? (
				chartsLoading ? (
					<ChartContentPlaceholder className="h-5 mt-1" />
				) : (
					<div className="text-xs text-gray-400/80 pt-0.5 text-center">
						No data available
					</div>
				)
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
