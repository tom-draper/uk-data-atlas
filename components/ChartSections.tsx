"use client";

import type { ReactNode } from "react";
import type { DatasetTheme } from "@uk-data-atlas/datasets";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CHART_SECTIONS } from "@/lib/datasets/chartSections";
import ChartCards, {
	hasVisibleChart,
	type ChartCardsProps,
} from "./ChartCards";

type ChartSectionsProps = Omit<ChartCardsProps, "theme" | "visibility"> & {
	/**
	 * Cards that are not registry charts, shown after a section's charts under
	 * the same heading, such as the transport map layers. `undefined` when
	 * there is nothing to add.
	 */
	extras?: Partial<Record<DatasetTheme, ReactNode>>;
};

type ChartSectionProps = Omit<ChartCardsProps, "theme" | "visibility"> & {
	theme: DatasetTheme;
	title: string;
	showBorder: boolean;
	extra?: ReactNode;
};

function ChartSection({
	theme,
	title,
	showBorder,
	extra,
	...props
}: ChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const hasCharts = hasVisibleChart(theme, visibility);
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
				<ChartCards theme={theme} visibility={visibility} {...props} />
			)}
			{extra}
		</div>
	);
}

export default function ChartSections({
	extras,
	...props
}: ChartSectionsProps) {
	return CHART_SECTIONS.map(({ theme, title }, index) => (
		<ChartSection
			key={theme}
			theme={theme}
			title={title}
			showBorder={index > 0}
			extra={extras?.[theme]}
			{...props}
		/>
	));
}
