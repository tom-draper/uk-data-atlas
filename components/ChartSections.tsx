"use client";

import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CHART_GROUPS } from "@/lib/datasets/chartGroups";
import ChartCards, {
	hasVisibleChart,
	type ChartCardsProps,
} from "./ChartCards";

type ChartSectionProps = Omit<ChartCardsProps, "group" | "visibility"> & {
	group: string;
	title: string;
	showBorder: boolean;
};

function ChartSection({
	group,
	title,
	showBorder,
	...props
}: ChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	if (!hasVisibleChart(group, visibility)) return null;

	return (
		<div
			className={`space-y-2 ${showBorder ? "border-t pt-2" : "pt-2"} ${
				isDark ? "border-white/10" : "border-gray-200/80"
			}`}
		>
			<h3
				className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				{title}
			</h3>
			<ChartCards group={group} visibility={visibility} {...props} />
		</div>
	);
}

export default function ChartSections(
	props: Omit<ChartCardsProps, "group" | "visibility">,
) {
	return CHART_GROUPS.map(({ group, title }, index) => (
		<ChartSection
			key={group}
			group={group}
			title={title}
			showBorder={index > 0}
			{...props}
		/>
	));
}
