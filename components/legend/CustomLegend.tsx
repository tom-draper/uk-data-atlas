"use client";

import type { CustomDataset } from "@/lib/types";
import { getSequentialColorForValue } from "@/lib/helpers/colorScale/datasetColors";
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
		const { legend } = dataset.pointStyle;
		const options = rangeControls.displayOptions.custom;
		const values = legend.map(({ value }) => value);
		const range = {
			min: dataset.valueMin ?? Math.min(...values),
			max: dataset.valueMax ?? Math.max(...values),
		};
		return renderCategoryLegend(
			legend.map(({ value, label }) => ({
				id: String(value),
				color: getSequentialColorForValue(
					value,
					range,
					rangeControls.displayOptions.theme.id,
				),
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
