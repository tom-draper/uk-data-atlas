import { workplaceIncomeDatasetDefinition } from "@/lib/data/catalog/definitions";
import type {
	WorkplaceIncomeDataset,
	IncomeLADData,
} from "@uk-data-atlas/datasets/types/income";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import {
	workplacePay,
	averageWorkplacePay,
	type WorkplacePaySummary,
} from "@/lib/helpers/workplaceIncomeMeasures";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";
import { formatCount } from "@/lib/helpers/formatCount";
const aggregation = createBoundaryAggregationSpec(
	"workplace-pay",
	"localAuthority",
	(features, codeProperty, data: Record<string, IncomeLADData>) =>
		averageWorkplacePay(
			collectBoundaryRecords(features, data, codeProperty),
		),
);
const card = (
	measure: "annualMedian" | "annualMean" | "hourlyMedian" | "hourlyMean",
) =>
	defineValueCard<
		WorkplaceIncomeDataset,
		WorkplacePaySummary,
		WorkplacePaySummary
	>({
		heading: "Workplace pay",
		background: "income",
		layout: "centered",
		accent: "#10b981",
		coverage: "England",
		source: "ONS. ASHE Table 7, workplace-based pay, 2025.",
		unit: measure.startsWith("hourly") ? "per hour" : "per year",
		format: (value) =>
			measure.startsWith("hourly")
				? `£${value.toFixed(2)}/hour`
				: `£${formatCount(Math.round(value))}`,
		maximum: measure.startsWith("hourly") ? 60 : 80000,
		aggregate: (record) => record,
		value: (record) => workplacePay(record, measure),
		secondary: () =>
			"Regional values average available authority estimates",
	});
export const workplaceIncomeDefinition: ChartDatasetDefinition<WorkplaceIncomeDataset> =
	{
		...workplaceIncomeDatasetDefinition,
		chart: {
			group: "Economics",
			key: "economics-workplaceIncome",
			label: "Workplace Pay [2025]",
			defaultVisible: false,
			componentPath: "@/components/ValueCard",
			card: card("annualMedian"),
			cardForOptions: (options) => card(options.workplaceIncome.measure),
			calculateStats: (m, g, d, l, id) =>
				m.aggregate(aggregation, g, d, l, id),
			year: 2025,
		},
		map: {
			valueFor: (dataset, code, options) =>
				workplacePay(
					dataset.data[code],
					options.workplaceIncome.measure,
				),
			sourceMode: (_dataset, options) =>
				`workplaceIncome:${options.workplaceIncome.measure}`,
			colorRange: { min: 25000, max: 45000 },
			legend: {
				min: 0,
				max: 80000,
				bounds: (options) => ({
					min: 0,
					max: options.workplaceIncome.measure.startsWith("hourly")
						? 60
						: 80000,
				}),
				format: (value, options) =>
					`£${value.toFixed(options.workplaceIncome.measure.startsWith("hourly") ? 2 : 0)}${options.workplaceIncome.measure.startsWith("hourly") ? "/hour" : ""}`,
			},
		},
	};
