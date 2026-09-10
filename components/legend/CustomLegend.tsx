"use client";

import type { CustomDataset } from "@/lib/types";
import { renderCategoryLegend } from "../legendUtils";
import { DynamicRangeLegend, type RangeLegendControls } from "./RangeLegends";

export function CustomLegend({
	dataset,
	isDark,
	onPointLegendClick,
	onPointLegendRightClick,
	...rangeControls
}: {
	dataset: CustomDataset;
	isDark: boolean;
	onPointLegendClick: (value: string) => void;
	onPointLegendRightClick: (value: string) => void;
} & RangeLegendControls) {
	if (dataset.kind === "points" && dataset.pointStyle?.legend) {
		const { colorByValue, legend } = dataset.pointStyle;
		const options = rangeControls.displayOptions.custom;
		return renderCategoryLegend(
			legend.map(({ value, label }) => ({
				id: String(value),
				color: colorByValue?.[value] ?? "#999",
				name: label,
			})),
			options.selectedPointValue !== undefined,
			String(options.selectedPointValue),
			onPointLegendClick,
			rangeControls.overlayOpacity,
			isDark,
			new Set((options.excludedPointValues ?? []).map(String)),
			onPointLegendRightClick,
		);
	}

	return (
		<DynamicRangeLegend
			{...rangeControls}
			datasetKey="custom"
			absoluteRange={{ min: 0, max: 100 }}
			defaultRange={{ min: 0, max: 100 }}
		/>
	);
}
