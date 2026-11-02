import { planningApplicationsDatasetDefinition } from "@/lib/data/catalog/definitions";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import {
	planningValue,
	sumPlanningRecords,
	PLANNING_MEASURES,
} from "@/lib/helpers/planningApplicationsMeasures";
import { defineValueCard } from "./valueCard";
import type { IndicatorRecord } from "@uk-data-atlas/datasets/types/indicator";
const planningAggregation = createBoundaryAggregationSpec(
	"planning-counts",
	"any",
	(features, codeProperty, data: Record<string, IndicatorRecord>) =>
		sumPlanningRecords(
			collectBoundaryRecords(features, data, codeProperty),
		),
);

import type { IndicatorDataset } from "@uk-data-atlas/datasets/types/indicator";
import { indicatorCard } from "./indicatorCard";
import type { ChartDatasetDefinition } from "./types";
export const planningApplicationsDefinition: ChartDatasetDefinition<
	IndicatorDataset<"planningApplications">
> = {
	...planningApplicationsDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-planningApplications",
		label: "Planning Applications [2026 Q1]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: indicatorCard({
			heading: "Planning applications",
			unit: "received",
			maximum: 3_000,
		}),
		cardForOptions: (options) =>
			defineValueCard<
				IndicatorDataset<"planningApplications">,
				IndicatorRecord,
				IndicatorRecord
			>({
				heading: "Planning applications",
				coverage: "England",
				source: "MHCLG. Planning applications in England, 2026 Q1.",
				unit:
					PLANNING_MEASURES.find(
						({ value }) =>
							value === options.planningApplications.measure,
					)?.label ?? "Applications received",
				maximum: 3000,
				hoverRecord: true,
				aggregate: (record) => record,
				value: (record) =>
					planningValue(record, options.planningApplications.measure),
			}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(planningAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueFor: (dataset, code, options) =>
			planningValue(
				dataset.data[code],
				options.planningApplications.measure,
			),
		sourceMode: (_dataset, options) =>
			`planningApplications:${options.planningApplications.measure}`,
		colorRange: { min: 0, max: 1_500 },
		legend: {
			min: 0,
			max: 3_000,
			format: (v) => v.toLocaleString("en-GB"),
		},
	},
};
