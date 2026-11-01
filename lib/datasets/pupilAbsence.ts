import { pupilAbsenceDatasetDefinition } from "@uk-data-atlas/datasets/data/catalog/definitions/pupilAbsence";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "@uk-data-atlas/datasets/types/indicator";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { collectBoundaryRecords } from "@/lib/helpers/datasetAggregation/numeric";
import { ABSENCE_MEASURES } from "@/lib/helpers/pupilAbsenceMeasures";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";
type Measure = (typeof ABSENCE_MEASURES)[number]["value"];
export function absenceRate(
	record: IndicatorRecord | undefined,
	measure: Measure,
) {
	const denominator =
		record?.metrics?.[
			measure === "persistent" || measure === "severe"
				? "enrolments"
				: "sessions"
		];
	const count = record?.metrics?.[measure];
	return denominator && count !== undefined
		? (count / denominator) * 100
		: null;
}
export function sumAbsence(records: IndicatorRecord[]) {
	if (!records.length) return null;
	const metrics: Record<string, number> = {};
	for (const record of records)
		for (const [key, count] of Object.entries(record.metrics ?? {}))
			metrics[key] = (metrics[key] ?? 0) + count;
	return {
		code: "",
		name: "",
		value: (metrics.overall / metrics.sessions) * 100,
		metrics,
	};
}
const aggregation = createBoundaryAggregationSpec(
	"pupil-absence",
	"any",
	(features, codeProperty, data: Record<string, IndicatorRecord>) =>
		sumAbsence(collectBoundaryRecords(features, data, codeProperty)),
);
const card = (measure: Measure) =>
	defineValueCard<
		IndicatorDataset<"pupilAbsence">,
		IndicatorRecord,
		IndicatorRecord
	>({
		heading: "Pupil absence",
		period: "2024/25",
		coverage: "England",
		source: "DfE. Pupil absence in schools, full academic year 2024/25. County and unitary authorities.",
		unit:
			measure === "persistent" || measure === "severe"
				? "% enrolments"
				: "% sessions",
		digits: 1,
		maximum: 100,
		hoverRecord: true,
		aggregate: (record) => record,
		value: (record) => absenceRate(record, measure),
		secondary: () =>
			ABSENCE_MEASURES.find((option) => option.value === measure)?.label,
	});
export const pupilAbsenceDefinition: ChartDatasetDefinition<
	IndicatorDataset<"pupilAbsence">
> = {
	...pupilAbsenceDatasetDefinition,
	chart: {
		group: "Education",
		key: "education-pupilAbsence",
		label: "Pupil Absence [2024/25]",
		defaultVisible: false,
		componentPath: "@/components/ValueCard",
		card: card("overall"),
		cardForOptions: (options) => card(options.pupilAbsence.measure),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(aggregation, g, d, l, id),
		year: 2025,
	},
	map: {
		valueFor: (dataset, code, options) =>
			absenceRate(dataset.data[code], options.pupilAbsence.measure),
		sourceMode: (_dataset, options) =>
			`pupilAbsence:${options.pupilAbsence.measure}`,
		colorRange: { min: 0, max: 30 },
		legend: {
			min: 0,
			max: 100,
			format: (value, options) =>
				`${value.toFixed(1)}% ${options.pupilAbsence.measure === "persistent" || options.pupilAbsence.measure === "severe" ? "enrolments" : "sessions"}`,
		},
	},
};
