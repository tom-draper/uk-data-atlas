import type { SelectedArea } from "@/lib/types";

export const isConstituencyEstimate = (
	selectedArea: SelectedArea | null,
	hasData: boolean,
) => selectedArea?.type === "ward" && hasData;

export function ConstituencyEstimateIndicator({
	selectedArea,
	hasData,
	isDark,
	fallback,
}: {
	selectedArea: SelectedArea | null;
	hasData: boolean;
	isDark: boolean;
	fallback?: string;
}) {
	const isEstimate = isConstituencyEstimate(selectedArea, hasData);
	const label = isEstimate ? "Constituency" : fallback;
	if (!label) return null;

	return (
		<span
			className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
			title={
				isEstimate
					? "This ward is represented by its best-fit constituency; the figure is not ward-level data."
					: undefined
			}
		>
			{label}
		</span>
	);
}
