import { useChartsLoading } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ChartContentPlaceholder } from "./ChartLoadingPlaceholder";

/** The consistent empty/loading state for compact atlas chart cards. */
export function ChartDataPlaceholder() {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	return (
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
	);
}
