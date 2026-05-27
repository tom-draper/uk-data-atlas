"use client";
import {
	ActiveViz,
	AggregatedSIMDData,
	Dataset,
	SIMDDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

interface SIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SIMDDataset>;
	aggregatedData: Record<number, AggregatedSIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const QUINTILE_COLORS = [
	"#dc2626", // 1 - most deprived
	"#f97316", // 2
	"#eab308", // 3
	"#4ade80", // 4
	"#15803d", // 5 - least deprived
];

type SIMDRecord = SIMDDataset["data"][string];
const simdByCouncilArea = new WeakMap<SIMDDataset, Map<string, SIMDRecord[]>>();
function getSIMDIndex(dataset: SIMDDataset): Map<string, SIMDRecord[]> {
	let index = simdByCouncilArea.get(dataset);
	if (!index) {
		index = new Map();
		for (const record of Object.values(dataset.data)) {
			const arr = index.get(record.councilAreaCode);
			if (arr) arr.push(record);
			else index.set(record.councilAreaCode, [record]);
		}
		simdByCouncilArea.set(dataset, index);
	}
	return index;
}

function computeSimdStats(
	dataset: SIMDDataset,
	aggregatedData: Record<number, AggregatedSIMDData> | null,
	selectedArea: SelectedArea | null,
	chartsLoading: boolean,
) {
	if (chartsLoading) return null;

	const avg = (records: SIMDRecord[]) => {
		if (records.length === 0) return null;
		return {
			averageSIMDRank:
				records.reduce((s, r) => s + r.simdRank, 0) / records.length,
			averageSIMDQuintile:
				records.reduce((s, r) => s + r.simdQuintile, 0) / records.length,
		};
	};

	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const index = getSIMDIndex(dataset);

	if (selectedArea.type === "localAuthority")
		return avg(index.get(selectedArea.code) ?? []);

	if (selectedArea.type === "ward" && selectedArea.data)
		return avg(index.get(selectedArea.data.ladCode) ?? []);

	return null;
}

export default function SIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: SIMDChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const simdStats = dataset
		? computeSimdStats(dataset, aggregatedData, selectedArea, chartsLoading)
		: null;

	const isActive =
		activeDataset?.type === "simd" && activeDataset.id === dataset?.id;

	const quintile = simdStats
		? Math.round(simdStats.averageSIMDQuintile)
		: null;
	const quintileColor = quintile ? QUINTILE_COLORS[quintile - 1] : "#9ca3af";
	const hasData = simdStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? quintileColor : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20 block w-full text-left")}
			title="Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="relative z-10">
				<h3 className={chartHeadingClass(isDark)}>
					Deprivation (SIMD) [{dataset.year}]
				</h3>
				{hasData && simdStats ? (
					<div className="mt-0 flex items-start gap-2.5">
						<div className="shrink-0 w-7 text-right leading-none pt-0.5">
							<span
								className="text-2xl font-bold"
								style={{ color: quintileColor }}
							>
								{quintile}
							</span>
						</div>
						<div className="flex-1 flex flex-col gap-1 pt-2">
							<div className="flex gap-[2px]">
								{QUINTILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-5 rounded-[2px]"
										style={{
											backgroundColor:
												quintile === i + 1
													? color
													: isDark
														? "rgba(255,255,255,0.1)"
														: "rgba(0,0,0,0.08)",
										}}
									/>
								))}
							</div>
							<div className="flex justify-between">
								<span
									className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
								>
									most deprived
								</span>
								<span
									className={`text-[9px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									Scotland only
								</span>
							</div>
						</div>
					</div>
				) : (
					<div className="h-12 flex items-center justify-center">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full w-full" />
						) : (
							<div
								className={`text-xs pb-2 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
							>
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</button>
	);
}
