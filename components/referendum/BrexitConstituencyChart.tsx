"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitConstituencyDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface BrexitConstituencyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitConstituencyDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function BrexitConstituencyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	activeViz,
	setActiveViz,
}: BrexitConstituencyChartProps) {
	const dataset = availableDatasets?.[year];

	const brexitStats = useMemo(() => {
		if (!dataset) return null;

		if (selectedArea === null && aggregatedData && aggregatedData[dataset.year]) {
			const agg = aggregatedData[dataset.year];
			return {
				pctLeave: agg.pctLeave,
				pctRemain: agg.pctRemain,
			};
		}

		if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			selectedArea.data
		) {
			const code = selectedArea.code;
			const area = dataset.data?.[code];
			if (area) {
				return {
					pctLeave: area.pctLeave,
					pctRemain: 100 - area.pctLeave,
				};
			}
		}

		return null;
	}, [dataset, aggregatedData, selectedArea, year]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "brexitConstituency" &&
		activeDataset.id === dataset.id;

	const pctLeave = brexitStats?.pctLeave ?? 0;
	const pctRemain = brexitStats?.pctRemain ?? 0;
	const hasData = brexitStats !== null;

	const result = hasData ? (pctLeave > pctRemain ? "leave" : "remain") : null;

	const leaveBgColor = "rgb(180, 20, 20)";
	const remainBgColor = "rgb(30, 60, 180)";

	const activeBorderClass = isActive
		? result === "leave"
			? "border-red-400"
			: "border-blue-400"
		: result === "leave"
		? "hover:border-red-400"
		: "hover:border-blue-400";

	return (
		<div
			className={`p-2 rounded cursor-pointer overflow-hidden relative ${
				isActive
					? result === "leave"
						? "bg-red-50/60 border-2 border-red-400"
						: "bg-blue-50/60 border-2 border-blue-400"
					: `bg-white/60 border-2 border-gray-200/80 ${activeBorderClass}`
			}`}
			title="Hanretty, C. (2017). Areal interpolation and the UK's referendum on EU membership. Journal of Elections, Public Opinion and Parties, 27(4), 466–483. Published via House of Commons Library."
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<div className="relative z-10">
				<h3 className="text-xs font-bold text-gray-800/90">
					Hanretty Estimates [{dataset.year}]
				</h3>

				{hasData ? (
					<div className="mt-2 space-y-1">
						<div className="flex h-4 rounded overflow-hidden">
							<div
								style={{
									width: `${pctLeave.toFixed(1)}%`,
									backgroundColor: leaveBgColor,
								}}
							/>
							<div
								style={{
									width: `${pctRemain.toFixed(1)}%`,
									backgroundColor: remainBgColor,
								}}
							/>
						</div>

						<div className="flex justify-between text-xs font-semibold mt-1">
							<span style={{ color: leaveBgColor }}>
								Leave {pctLeave.toFixed(1)}%
							</span>
							<span style={{ color: remainBgColor }}>
								Remain {pctRemain.toFixed(1)}%
							</span>
						</div>
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
						<div className="text-xs text-gray-400/80 pt-0.5 text-center">
							No data available
						</div>
					</div>
				)}
			</div>
			</div>
	);
});
