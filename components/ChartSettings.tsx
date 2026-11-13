"use client";
import {
	CHART_CONFIG,
	useChartVisibility,
} from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { buildSettingsSections } from "@/lib/datasets/chartSettingsSections";

// Keep the settings menu in the same section and card order as the chart
// panel: a section per theme, its cards grouped under their topic. Every card
// is listed here, so this is where a card outside the defaults is switched on.
// A card also appears, marked as related, under the topics its dataset lists
// as related; it is the same card and switch.
const sections = buildSettingsSections(CHART_CONFIG);

function CardToggle({
	label,
	source,
	checked,
	onChange,
	isDark,
	note,
}: {
	label: string;
	source: string;
	checked: boolean;
	onChange: () => void;
	isDark: boolean;
	note?: string;
}) {
	return (
		<label
			className="flex items-center gap-2 cursor-pointer group"
			title={source}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				className="size-3 accent-indigo-500 cursor-pointer"
			/>
			<span
				className={`text-xs transition-colors ${isDark ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600 group-hover:text-gray-800"}`}
			>
				{label}
				{note && (
					<span className="ml-1 text-[10px] text-gray-500">
						{note}
					</span>
				)}
			</span>
		</label>
	);
}

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
						{topics.map(({ topic, items, related }) => (
							<div key={topic} className="space-y-1.5">
								<h5 className="text-[11px] font-medium text-gray-500">
									{topic}
								</h5>
								{items.map(({ key, label, source }) => (
									<CardToggle
										key={key}
										label={label}
										source={source}
										checked={visibility[key]}
										onChange={() => toggle(key)}
										isDark={isDark}
									/>
								))}
								{related.length > 0 && (
									<div
										className="space-y-1.5 border-l pl-2 border-gray-500/30"
										data-testid="related-cards"
									>
										<h6 className="text-[10px] italic text-gray-500">
											Related
										</h6>
										{related.map(
											({
												key,
												label,
												source,
												filedUnder,
											}) => (
												<CardToggle
													key={key}
													label={label}
													source={source}
													checked={visibility[key]}
													onChange={() => toggle(key)}
													isDark={isDark}
													note={`from ${filedUnder}`}
												/>
											),
										)}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
