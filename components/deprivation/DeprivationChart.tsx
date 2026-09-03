"use client";
import type { ActiveViz, Dataset, SelectedArea } from "@lib/types";
import { useIsDark } from "@/lib/context/ThemeContext";
import DecileChart from "./DecileChart";

/** The identity and wording of one national deprivation index. */
export interface DeprivationIndex {
	/** Dataset type as it appears on the active dataset, e.g. "imd". */
	datasetType: Dataset["type"];
	/** Short name shown in the heading, e.g. "IMD". */
	label: string;
	region: string;
	attribution: string;
}

/** The one line of detail under the decile: a rank, or a deprivation score. */
export type DeprivationDetail =
	{ kind: "rank"; value: number } | { kind: "score"; value: number };

export function DeprivationChart({
	index,
	dataset,
	activeDataset,
	selectedArea,
	decile,
	detail,
	setActiveViz,
	extraClassName,
}: {
	index: DeprivationIndex;
	dataset: { id: string; type: Dataset["type"]; year: number };
	activeDataset: Dataset | null;
	selectedArea: SelectedArea | null;
	decile: number | null;
	detail: DeprivationDetail | null;
	setActiveViz: (value: ActiveViz) => void;
	extraClassName?: string;
}) {
	const isDark = useIsDark();
	// A rank only means something for one area; the aggregate of a whole
	// selection does not, so it is shown only alongside a selected area.
	const showDetail =
		detail !== null &&
		Number.isFinite(detail.value) &&
		(detail.kind === "score" || selectedArea !== null);

	return (
		<DecileChart
			title={index.attribution}
			heading={`Deprivation (${index.label}) [${dataset.year}]`}
			region={index.region}
			decile={decile === null ? null : Math.round(decile)}
			hasData={decile !== null}
			extraClassName={extraClassName}
			footer={
				showDetail ? (
					<span
						className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}
					>
						{detail.kind === "rank"
							? `Rank ${Math.round(detail.value).toLocaleString()}`
							: `Score ${detail.value.toFixed(1)}`}
					</span>
				) : null
			}
			isActive={
				activeDataset?.type === index.datasetType &&
				activeDataset.id === dataset.id
			}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		/>
	);
}
