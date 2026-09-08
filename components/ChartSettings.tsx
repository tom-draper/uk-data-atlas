"use client";
import {
	CHART_CONFIG,
	useChartVisibility,
} from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CHART_GROUPS } from "@/lib/datasets/chartGroups";

// Keep the settings menu in exactly the same group and chart order as the
// chart panel. CHART_CONFIG supplies the within-group order used by ChartCards.
const groups = CHART_GROUPS.flatMap(({ group, title }) => {
	const items = CHART_CONFIG.filter((item) => item.group === group).map(
		({ key, label }) => ({ key, label }),
	);
	return items.length > 0 ? [{ title, items }] : [];
});

export default function ChartSettings() {
	const { visibility, toggle } = useChartVisibility();
	const isDark = useIsDark();

	return (
		<div className="flex-1 p-2.5 overflow-y-auto scroll-container space-y-4">
			{groups.map(({ title, items }) => (
				<div key={title}>
					<h4
						className={`text-xs font-bold mb-1.5 ${isDark ? "text-gray-200" : "text-gray-700"}`}
					>
						{title}
					</h4>
					<div className="space-y-1.5">
						{items.map(({ key, label }) => (
							<label
								key={key}
								className="flex items-center gap-2 cursor-pointer group"
							>
								<input
									type="checkbox"
									checked={visibility[key]}
									onChange={() => toggle(key)}
									className="size-3 accent-indigo-500 cursor-pointer"
								/>
								<span
									className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
								>
									{label}
								</span>
							</label>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
