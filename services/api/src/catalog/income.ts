import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/** Median gross pay of employees in each English authority, by residence or workplace. */
export const compileIncome = (
	manifest: CatalogManifest,
	incomePath: string,
	england2025: string[],
	options: { datasetId: "income" | "workplace-income" } = {
		datasetId: "income",
	},
): CompiledMeasure[] => {
	const workplace = options.datasetId === "workplace-income";
	const medianPay = (
		id: string,
		label: string,
		field: string,
		unit: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "currency",
		unit,
		aggregation: {
			kind: "non-aggregatable",
			statistic: "median",
			note: "A median of authorities' medians is not the median pay of their combined residents, and no weight recovers it.",
			available: false,
		},
		notes: [note],
	});
	return publishIndicators(manifest, {
		datasetId: options.datasetId,
		path: incomePath,
		boundaryYear: 2025,
		period: "2025",
		expectedCodes: england2025,
		// The table interleaves county, region and England totals with the
		// authorities; only unitary, district, metropolitan and London borough
		// rows are authorities.
		isAuthority: (code) => /^E0[6-9]/.test(code),
		coverageNote:
			"Published source records cover English authorities only. An authority whose estimate the publisher suppressed as unreliable has no value.",
		notes: [
			`Annual Survey of Hours and Earnings, 2025 provisional results, Table ${workplace ? "7" : "8"}: pay of employee jobs by the local authority ${workplace ? "where the employee works" : "the employee lives"}. Every employee job counts, full and part time; the self-employed are not included.`,
			"Gross pay, before tax and other deductions. The mean and percentiles the table also publishes are not served.",
			"Provisional results are revised when the following year's survey is published.",
		],
		indicators: [
			medianPay(
				workplace ? "median-workplace-annual-pay" : "median-annual-pay",
				workplace
					? "Median gross annual workplace pay"
					: "Median gross annual pay",
				"annual.median",
				"£ per year",
				"Annual pay is estimated only for employees who have been in the same job for at least a year.",
			),
			medianPay(
				workplace ? "median-workplace-hourly-pay" : "median-hourly-pay",
				workplace
					? "Median gross hourly workplace pay"
					: "Median gross hourly pay",
				"hourly.median",
				"£ per hour",
				"Gross hourly pay includes overtime pay and overtime hours; the publisher's separate table excluding overtime is not served.",
			),
		],
	});
};
