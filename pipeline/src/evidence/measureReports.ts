import {
	coveragePlan,
	reconcileMeasure,
	type Measure,
	type MeasureContext,
	type ReconciliationRouteRequest,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";

export const reconciliationEvidence = (
	context: MeasureContext,
	measure: Measure,
	selection: ReconciliationRouteRequest,
	period: string,
) => {
	const unavailable = context.geographyResolver.requires("crosswalks");
	if (unavailable)
		throw new Error(
			`Crosswalks unavailable: ${publicJson(unavailable.body)}`,
		);
	const result = reconcileMeasure(context, measure, selection, period);
	return "refusal" in result
		? {
				status: 422 as const,
				data: {
					type: "https://api.ukdataatlas.com/problems/operation-not-supported",
					title: "Operation Not Supported",
					status: 422,
					detail: result.refusal,
					code: "conversion_not_available",
				},
			}
		: { status: 200 as const, data: result };
};

export const coveragePlanEvidence = (
	context: MeasureContext,
	measure: Measure,
	target: { geography: string; boundaryRelease: string },
) => {
	const unavailable = context.geographyResolver.requires("areas");
	if (unavailable)
		throw new Error(
			`Area identities unavailable: ${publicJson(unavailable.body)}`,
		);
	if (
		!context.geographyResolver.hasAreaRelease(
			target.geography,
			target.boundaryRelease,
		)
	) {
		const { detail, ...absence } =
			context.geographyResolver.explainAreaAbsence(
				target.geography,
				target.boundaryRelease,
				"",
			) ?? {
				detail: "No compiled boundary registry is available to explain this area identity.",
			};
		return {
			status: 404 as const,
			data: {
				type: "https://api.ukdataatlas.com/problems/not-found",
				title: "Not Found",
				status: 404,
				detail,
				...absence,
			},
		};
	}
	const plan = coveragePlan(context, measure, target);
	if (!plan) throw new Error("Measure coverage plan unavailable");
	return { status: 200 as const, data: plan };
};
