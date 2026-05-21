"use client";
import {
	CHART_CONFIG,
	ChartKey,
	useChartVisibility,
} from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";

const groups = CHART_CONFIG.reduce<Record<string, { key: ChartKey; label: string }[]>>(
	(acc, item) => {
		if (!acc[item.group]) acc[item.group] = [];
		acc[item.group].push({ key: item.key, label: item.label });
		return acc;
	},
	{},
);

export default function ChartSettings() {
	const { visibility, toggle } = useChartVisibility();
	const isDark = useIsDark();

	return (
		<div className="flex-1 px-2.5 overflow-y-auto scroll-container py-2.5 space-y-4">
			{Object.entries(groups).map(([group, items]) => (
				<div key={group}>
					<h4 className={`text-xs font-bold mb-1.5 ${isDark ? "text-gray-200" : "text-gray-700"}`}>
						{group}
					</h4>
					<div className="space-y-1.5">
						{items.map(({ key, label }) => (
							<label key={key} className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={visibility[key]}
									onChange={() => toggle(key)}
									className="w-3 h-3 accent-indigo-500 cursor-pointer"
								/>
								<span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{label}</span>
							</label>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
