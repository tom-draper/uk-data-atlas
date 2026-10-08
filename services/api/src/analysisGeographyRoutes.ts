import { analysisConversion } from "./analysisGeographies";
import { unsupported } from "./capability";
import { coveragePlan } from "./coveragePlan";
import { relationshipPurposeFor } from "./relationshipPaths";
import { parseExactReleaseReference } from "./releaseForDate";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";

const supportFor = (
	inventory: NonNullable<
		RouteRequest["context"]["analysisGeographyInventory"]
	>,
	measureId: string,
	analysisGeography: { geography: string; boundaryRelease: string },
	source?: { geography: string; boundaryYear: string | null },
) =>
	inventory.supports.filter(
		(support) =>
			support.measureId === measureId &&
			support.analysisGeography.geography ===
				analysisGeography.geography &&
			support.analysisGeography.boundaryRelease ===
				analysisGeography.boundaryRelease &&
			(source === undefined ||
				(support.source.geography === source.geography &&
					String(support.source.boundaryYear) ===
						source.boundaryYear)),
	);

const operationFor = (purpose: "identity" | "membership" | "apportion") =>
	purpose === "identity"
		? "code-translation"
		: purpose === "membership"
			? "containment-aggregation"
			: "weighted-allocation";

/** The already-reviewed route, re-expressed with conversion-plan evidence. */
const conversionPlanFor = (
	context: RouteRequest["context"],
	support: NonNullable<
		RouteRequest["context"]["analysisGeographyInventory"]
	>["supports"][number],
) => {
	if (support.crosswalk) {
		const crosswalk = context.crosswalkInventory?.crosswalks.find(
			(candidate) => candidate.id === support.crosswalk?.id,
		);
		const purpose = crosswalk && relationshipPurposeFor(crosswalk);
		return crosswalk && purpose
			? context.geographyResolver.conversionPlan(
					crosswalk.from,
					crosswalk.to,
					purpose,
					operationFor(purpose),
				)
			: undefined;
	}
	const path = context.relationshipPathInventory?.paths.find(
		(candidate) => candidate.id === support.path?.id,
	);
	return path
		? context.geographyResolver.conversionPlan(
				path.from,
				path.to,
				path.purpose,
				operationFor(path.purpose),
			)
		: undefined;
};

/** The evidence around a plan, without reading or transforming observations. */
const planEvidence = (
	context: RouteRequest["context"],
	measureId: string,
	period: string,
	analysisGeography: { geography: string; boundaryRelease: string },
	support: NonNullable<
		RouteRequest["context"]["analysisGeographyInventory"]
	>["supports"][number],
	validation: RouteRequest["context"]["analysisGeographyValidationInventory"],
) => {
	const measure = context.dataCatalog?.measures.find(
		(candidate) => candidate.id === measureId,
	);
	const coverage = measure
		? coveragePlan(context, measure, analysisGeography)
		: undefined;
	const receipt = validation?.supports
		.find(
			(candidate) =>
				candidate.measureId === measureId &&
				candidate.analysisGeography.geography ===
					analysisGeography.geography &&
				candidate.analysisGeography.boundaryRelease ===
					analysisGeography.boundaryRelease &&
				candidate.source.datasetId === support.source.datasetId &&
				candidate.source.geography === support.source.geography &&
				candidate.source.boundaryYear === support.source.boundaryYear,
		)
		?.periods.find((candidate) => candidate.period === period);
	const conversionPlan = conversionPlanFor(context, support);
	return {
		...(measure ? { aggregation: measure.aggregation } : {}),
		...(coverage ? { coverage } : {}),
		...(coverage
			? {
					expectedSize: {
						targetAreaCount: coverage.target.areaCount,
						coveredAreaCount: coverage.summary.coveredAreaCount,
						outputRecordCount:
							receipt?.outputRecordCount ??
							coverage.summary.coveredAreaCount,
					},
				}
			: {}),
		...(conversionPlan ? { conversionPlan } : {}),
		saferAlternatives: [
			{
				kind: "source-exact" as const,
				href: `/v1/data/${measureId}?period=${encodeURIComponent(period)}&geography=${support.source.geography}&boundaryYear=${support.source.boundaryYear}`,
				reason: "Keep the publisher's source partition when a conversion is not needed.",
			},
			...(coverage &&
			coverage.summary.coveredAreaCount < coverage.target.areaCount
				? [
						{
							kind: "coverage-plan" as const,
							href: `/v1/measures/${measureId}/coverage-plan?geography=${analysisGeography.geography}&release=${analysisGeography.boundaryRelease}`,
							reason: "Inspect the country-by-country gap before using a partial analysis frame.",
						},
					]
				: []),
		],
	};
};

/**
 * Advertise and preflight only reviewed source-to-analysis conversions. This
 * is intentionally a plan: it reads no values and never selects a crosswalk
 * merely because a geographically plausible one exists.
 */
export const handleAnalysisGeographyRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const inventory = context.analysisGeographyInventory;
	const validation = context.analysisGeographyValidationInventory;
	if (!inventory)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the analysis geography inventory before planning an analysis.",
		);
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "analysis-geographies"
	) {
		const measureId = parsedUrl.searchParams.get("measure");
		const supports = inventory.supports.filter(
			(support) => measureId === null || support.measureId === measureId,
		);
		return {
			status: 200,
			body: envelope(releaseId, {
				analysisGeographies: supports.map((support) => ({
					...support.analysisGeography,
					measureId: support.measureId,
					source: support.source,
					basis: "derived" as const,
					conversion: analysisConversion(support),
					note: support.note,
				})),
			}),
		};
	}
	const measureId = segments[2];
	const isConversionSupport =
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "measures" &&
		segments[3] === "conversion-support";
	const isPlan =
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "analysis:plan";
	if (!isConversionSupport && !isPlan) return undefined;
	const requestedMeasure = isPlan
		? parsedUrl.searchParams.get("measure")
		: measureId;
	const to = parseExactReleaseReference(parsedUrl.searchParams.get("to"));
	if (!requestedMeasure || !to)
		return invalidQuery("measure and to=geography/release are required.");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	if (isPlan && (!geography || !boundaryYear))
		return invalidQuery(
			"geography and boundaryYear are required when planning an analysis, so the API never chooses between source partitions.",
		);
	const supports = supportFor(
		inventory,
		requestedMeasure,
		to,
		geography ? { geography, boundaryYear } : undefined,
	);
	if (!isPlan)
		return {
			status: 200,
			body: envelope(releaseId, {
				measureId: requestedMeasure,
				analysisGeography: to,
				...(supports.length > 0
					? { status: "available" as const, supports }
					: unsupported(
							`No reviewed conversion is published for ${requestedMeasure} on ${to.geography}/${to.boundaryRelease}.`,
						)),
			}),
		};
	const period = parsedUrl.searchParams.get("period");
	if (!period)
		return invalidQuery("period is required when planning an analysis.");
	const support = supports.find((candidate) =>
		candidate.source.periods.includes(period),
	);
	const unavailableEvidence = supports[0]
		? planEvidence(
				context,
				requestedMeasure,
				period,
				to,
				supports[0],
				validation,
			)
		: {};
	if (!support)
		return {
			status: 200,
			body: envelope(releaseId, {
				measureId: requestedMeasure,
				period,
				analysisGeography: to,
				status: "not-comparable" as const,
				reason:
					supports.length > 0
						? `${period} is not published by the requested source partition; supported periods are ${supports.flatMap((candidate) => candidate.source.periods).join(", ")}.`
						: `No reviewed conversion is published from ${geography}/${boundaryYear} to ${to.geography}/${to.boundaryRelease} for ${requestedMeasure}.`,
				...unavailableEvidence,
			}),
		};
	const evidence = planEvidence(
		context,
		requestedMeasure,
		period,
		to,
		support,
		validation,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			measureId: requestedMeasure,
			period,
			analysisGeography: to,
			status: "available" as const,
			basis: "derived" as const,
			source: support.source,
			conversion: analysisConversion(support),
			note: support.note,
			...evidence,
			result: `/v1/data/${requestedMeasure}/convert?period=${encodeURIComponent(period)}&geography=${support.source.geography}&boundaryYear=${support.source.boundaryYear}&${support.path ? "path" : "crosswalk"}=${encodeURIComponent(analysisConversion(support).id)}`,
		}),
	};
};
