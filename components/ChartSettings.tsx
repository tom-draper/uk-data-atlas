"use client";
import {
	CHART_CONFIG,
	useChartVisibility,
} from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CHART_SECTIONS } from "@/lib/datasets/chartSections";
import { topicsOfTheme } from "@uk-data-atlas/datasets";

// Keep the settings menu in the same section and card order as the chart
// panel: a section per theme, its cards grouped under their topic. Every card
// is listed here, so this is where a card outside the defaults is switched on.
const sections = CHART_SECTIONS.flatMap(({ theme, title }) => {
	const topics = topicsOfTheme(theme).flatMap((topic) => {
		const items = CHART_CONFIG.filter(
			(item) => item.topic === topic.id,
		).map(({ key, label, source }) => ({ key, label, source }));
		return items.length > 0 ? [{ topic: topic.label, items }] : [];
	});
	return topics.length > 0 ? [{ title, topics }] : [];
});

export default function ChartSettings() {
	const { visibility, toggle } = useChartVisibility();
	const isDark = useIsDark();

	return (
		<div className="flex-1 p-2.5 overflow-y-auto scroll-container space-y-4">
			{sections.map(({ title, topics }) => (
				<div key={title}>
					<h4
						className={`text-xs font-bold mb-1.5 ${isDark ? "text-gray-200" : "text-gray-700"}`}
					>
						{title}
					</h4>
					<div className="space-y-2">
						{topics.map(({ topic, items }) => (
							<div key={topic} className="space-y-1.5">
								<h5 className="text-[11px] font-medium text-gray-500">
									{topic}
								</h5>
								{items.map(({ key, label, source }) => (
									<label
										key={key}
										className="flex items-center gap-2 cursor-pointer group"
										title={source}
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
						))}
					</div>
				</div>
			))}
		</div>
	);
}
