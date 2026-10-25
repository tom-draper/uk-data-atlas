import { publicHealthDatasetDefinition } from "@uk-data-atlas/datasets/data/catalog/definitions/publicHealth";
import {
	PUBLIC_HEALTH_MEASURES,
	type PublicHealthRecord,
	type PublicHealthDataset,
	type PublicHealthMeasure,
} from "@uk-data-atlas/datasets/data/public-health/loader";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";
export function averagePublicHealth(
	records: PublicHealthRecord[],
): PublicHealthRecord | null {
	if (!records.length) return null;
	const metrics: PublicHealthRecord["metrics"] = {};
	for (const { value: key } of PUBLIC_HEALTH_MEASURES) {
		const values = records.flatMap((record) => {
			const value = record.metrics[key];
			return value === undefined ? [] : [value];
		});
		if (values.length)
			metrics[key] = values.reduce((a, b) => a + b, 0) / values.length;
	}
	return { code: "", name: "", metrics, isAverage: true };
}
const aggregation = createBoundaryAggregationSpec(
	"public-health",
	"any",
	(features, codeProperty, data: PublicHealthDataset["data"]) =>
		averagePublicHealth(
			collectBoundaryRecords(features, data, codeProperty),
		),
);
const card = (measure: PublicHealthMeasure) => {
	const option =
		PUBLIC_HEALTH_MEASURES.find((option) => option.value === measure) ??
		PUBLIC_HEALTH_MEASURES[0];
	return defineValueCard<
		PublicHealthDataset,
		PublicHealthRecord,
		PublicHealthRecord
	>({
		heading: option.label,
		period:
			measure === "smoking" || measure === "preventableMortality"
				? "2024"
				: "2024/25",
		coverage: "England",
		source: "OHID. Public Health Outcomes Framework. Mortality is age-standardised. Regional summaries are unweighted authority means, not pooled population rates.",
		unit: option.unit,
		digits: 1,
		maximum: option.maximum,
		hoverRecord: true,
		aggregate: (record) => record,
		value: (record) => record.metrics[measure] ?? null,
		secondary: (record) =>
			record.isAverage
				? undefined
				: "County / unitary authority estimate",
	});
};
export const publicHealthDefinition: ChartDatasetDefinition<PublicHealthDataset> =
	{
		...publicHealthDatasetDefinition,
		chart: {
			group: "Health",
			key: "health-publicHealth",
			label: "Public Health [2024-2025]",
			defaultVisible: false,
			componentPath: "@/components/ValueCard",
			card: card("smoking"),
			cardForOptions: (options) => card(options.publicHealth.measure),
			calculateStats: (m, g, d, l, id) =>
				m.aggregate(aggregation, g, d, l, id),
			year: 2025,
		},
		map: {
			valueFor: (dataset, code, options) =>
				dataset.data[code]?.metrics[options.publicHealth.measure] ??
				null,
			sourceMode: (_dataset, options) =>
				`publicHealth:${options.publicHealth.measure}`,
			colorRange: { min: 0, max: 100 },
			legend: {
				min: 0,
				max: 100,
				bounds: (options) => ({
					min: 0,
					max:
						options.publicHealth.measure === "preventableMortality"
							? 400
							: 100,
				}),
				format: (value, options) =>
					`${value.toFixed(1)} ${options.publicHealth.measure === "preventableMortality" ? "per 100,000, age-standardised" : "%"}`,
			},
		},
	};
