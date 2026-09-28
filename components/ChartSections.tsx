"use client";

import type { ReactNode } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CHART_GROUPS } from "@/lib/datasets/chartGroups";
import ChartCards, {
	hasVisibleChart,
	type ChartCardsProps,
} from "./ChartCards";

type ChartSectionsProps = Omit<ChartCardsProps, "group" | "visibility"> & {
	/**
	 * Cards that are not registry charts, shown after a group's charts under
	 * the same heading, such as the transport map layers. `undefined` when
	 * there is nothing to add.
	 */
	extras?: Partial<Record<string, ReactNode>>;
};

type ChartSectionProps = Omit<ChartCardsProps, "group" | "visibility"> & {
	group: string;
	title: string;
	showBorder: boolean;
	extra?: ReactNode;
};

function ChartSection({
	group,
	title,
	showBorder,
	extra,
	...props
}: ChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const hasCharts = hasVisibleChart(group, visibility);
	if (!hasCharts && !extra) return null;

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
			{hasCharts && (
				<ChartCards group={group} visibility={visibility} {...props} />
			)}
			{extra}
		</div>
	);
}

export default function ChartSections({
	extras,
	...props
}: ChartSectionsProps) {
	return CHART_GROUPS.map(({ group, title }, index) => (
		<ChartSection
			key={group}
			group={group}
			title={title}
			showBorder={index > 0}
			extra={extras?.[group]}
			{...props}
		/>
	));
}
