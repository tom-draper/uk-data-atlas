"use client";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
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

interface IMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IMDDataset>;
	aggregatedData: Record<number, AggregatedIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const DECILE_COLORS = [
	"#dc2626", // 1 - most deprived
	"#ef4444", // 2
	"#f97316", // 3
	"#f59e0b", // 4
	"#eab308", // 5
	"#a3e635", // 6
	"#4ade80", // 7
	"#22c55e", // 8
	"#16a34a", // 9
	"#15803d", // 10 - least deprived
];

type IMDRecord = IMDDataset["data"][string];
const imdByLAD = new WeakMap<IMDDataset, Map<string, IMDRecord[]>>();
function getIMDIndex(dataset: IMDDataset): Map<string, IMDRecord[]> {
	let index = imdByLAD.get(dataset);
	if (!index) {
		index = new Map();
		for (const record of Object.values(dataset.data)) {
			const arr = index.get(record.ladCode);
			if (arr) arr.push(record);
			else index.set(record.ladCode, [record]);
		}
		imdByLAD.set(dataset, index);
	}
	return index;
}

function computeImdStats(
	dataset: IMDDataset,
	aggregatedData: Record<number, AggregatedIMDData> | null,
	selectedArea: SelectedArea | null,
	chartsLoading: boolean,
) {
	if (chartsLoading) return null;

	const avg = (records: IMDRecord[]) => {
		if (records.length === 0) return null;
		return {
			averageIMDScore:
				records.reduce((s, r) => s + r.imdScore, 0) / records.length,
			averageIMDDecile:
				records.reduce((s, r) => s + r.imdDecile, 0) / records.length,
		};
	};

	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "lsoa") {
		const record = dataset.data[selectedArea.code];
		return record
			? { averageIMDScore: record.imdScore, averageIMDDecile: record.imdDecile }
			: null;
	}

	const index = getIMDIndex(dataset);

	if (selectedArea.type === "localAuthority")
		return avg(index.get(selectedArea.code) ?? []);

	if (selectedArea.type === "ward" && selectedArea.data)
		return avg(index.get(selectedArea.data.ladCode) ?? []);

	return null;
}

export default function IMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: IMDChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const imdStats = dataset
		? computeImdStats(dataset, aggregatedData, selectedArea, chartsLoading)
		: null;

	const isActive = !!(dataset && activeDataset?.type === "imd" && activeDataset.id === dataset.id);

	const decile = imdStats ? Math.round(imdStats.averageIMDDecile) : null;
	const decileColor = decile ? DECILE_COLORS[decile - 1] : "#9ca3af";
	const hasData = imdStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData && dataset ? decileColor : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk"
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
			<div className="relative z-10 flex flex-col flex-1">
				<h3 className={chartHeadingClass(isDark)}>
					Deprivation (IMD) [{dataset.year}]
				</h3>
				{hasData && imdStats ? (
					<div className="mt-0 flex items-start gap-2.5">
						<div className="shrink-0 w-7 text-right leading-none pt-0.5">
							<span
								className="text-2xl font-bold"
								style={{ color: decileColor }}
							>
								{decile}
							</span>
						</div>
						<div className="flex-1 flex flex-col gap-1 pt-2">
							<div className="flex gap-[2px]">
								{DECILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-5 rounded-[2px]"
										style={{
											backgroundColor:
												decile === i + 1
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
									Score {imdStats.averageIMDScore.toFixed(1)}
								</span>
							</div>
						</div>
					</div>
				) : (
					<div className="flex-1 mt-1">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full" />
						) : (
							<div
								className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
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
