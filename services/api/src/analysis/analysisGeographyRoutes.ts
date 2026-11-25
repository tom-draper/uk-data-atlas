import {
	analysisConversion,
	buildTranslationSteps,
	type AnalysisGeographySupport,
} from "@uk-data-atlas/relationships";
import { unsupported } from "@uk-data-atlas/areas";
import { reviewedCoveragePlan } from "@uk-data-atlas/catalogue/node";
import {
	convertThroughSteps,
	isNumericObservation,
	measureSeriesKey,
	observationsFor,
	type Measure,
} from "@uk-data-atlas/measures";
import { relationshipPurposeFor } from "@uk-data-atlas/relationships";
import { parseExactReleaseReference } from "@uk-data-atlas/areas";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "../runtime/routeResponse.ts";
import type { RouteRequest } from "../runtime/routing.ts";

const supportFor = (
	inventory: NonNullable<
		RouteRequest["context"]["analysisGeographyInventory"]
	>,
	measureId: string,
	analysisGeography: { geography: string; boundaryRelease: string },
	source?: {
		geography: string;
		boundaryYear: string | null;
		datasetId: string | null;
	},
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
						source.boundaryYear &&
					(source.datasetId === null ||
						support.source.datasetId === source.datasetId))),
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

/** Older receipts lack target codes. Reproduce the reviewed conversion for that period. */
const reviewedTargetCodes = (
	context: RouteRequest["context"],
	measure: Measure,
	support: AnalysisGeographySupport,
	period: string,
) => {
	const source = measure.sources.find(
		(candidate) =>
			candidate.datasetId === support.source.datasetId &&
			candidate.sourceGeography.type === support.source.geography &&
			candidate.sourceGeography.boundaryYear ===
				support.source.boundaryYear,
	);
	if (!source) return undefined;
	const records = observationsFor(measure.id, source, period, {
		measureObservations: context.measureObservations,
		seriesKey: measure.series && measureSeriesKey(measure.series),
	})?.records;
	if (!records?.every(isNumericObservation)) return undefined;
	const route = support.path?.steps ?? [
		{ crosswalk: support.crosswalk!, direction: "forward" as const },
	];
	const steps = [];
	for (const { crosswalk, direction } of route) {
		const artifact = context.geographyResolver.crosswalk(crosswalk.id);
		if (!artifact) return undefined;
		steps.push({
			artifact,
			direction,
			steps: buildTranslationSteps(artifact, direction),
		});
	}
	const converted = convertThroughSteps(steps, records);
	return converted.status === "converted" && converted.method === "exact"
		? converted.records.map(({ areaCode }) => areaCode)
		: undefined;
};

const planEvidence = (
	context: RouteRequest["context"],
	support: AnalysisGeographySupport,
	period: string,
	result?: string,
) => {
	const { measureId, analysisGeography } = support;
	const measure = context.dataCatalog?.measures.find(
		(candidate) => candidate.id === measureId,
	);
	const receipt = result
		? context.analysisGeographyValidationInventory?.supports
				.find(
					(candidate) =>
						candidate.measureId === measureId &&
						candidate.analysisGeography.geography ===
							analysisGeography.geography &&
						candidate.analysisGeography.boundaryRelease ===
							analysisGeography.boundaryRelease &&
						candidate.source.datasetId ===
							support.source.datasetId &&
						candidate.source.geography ===
							support.source.geography &&
						candidate.source.boundaryYear ===
							support.source.boundaryYear &&
						candidate.path?.id === support.path?.id &&
						candidate.crosswalk?.id === support.crosswalk?.id,
				)
				?.periods.find((candidate) => candidate.period === period)
		: undefined;
	const areas = result
		? context.geographyResolver.releaseAreas(
				analysisGeography.geography,
				analysisGeography.boundaryRelease,
			)
		: undefined;
	const targetCodes =
		receipt?.targetCodes ??
		(measure && areas
			? reviewedTargetCodes(context, measure, support, period)
			: undefined);
	const coverage =
		measure && areas && targetCodes && result
			? reviewedCoveragePlan(
					measure,
					analysisGeography,
					areas,
					targetCodes,
					{
						...(support.path
							? {
									path: {
										id: support.path.id,
										purpose: support.path.purpose,
										quality: support.path.quality,
									},
								}
							: { crosswalk: support.crosswalk! }),
						source: {
							datasetId: support.source.datasetId,
							geography: support.source.geography,
							boundaryYear: support.source.boundaryYear,
							period,
						},
						method: "exact",
						href: result,
					},
				)
			: undefined;
	const conversionPlan = conversionPlanFor(context, support);
	return {
		...(measure ? { aggregation: measure.aggregation } : {}),
		...(coverage ? { coverage } : {}),
		...(coverage && targetCodes
			? {
					expectedSize: {
						targetAreaCount: coverage.target.areaCount,
						coveredAreaCount: coverage.summary.coveredAreaCount,
						outputRecordCount: targetCodes.length,
					},
				}
			: {}),
		...(conversionPlan ? { conversionPlan } : {}),
		saferAlternatives: [
			{
				kind: "source-exact" as const,
				href: `/v1/data/${measureId}?${sourceQuery(support, result ? period : undefined)}`,
				reason: "Keep the publisher's source partition when a conversion is not needed.",
			},
			...(coverage &&
			coverage.summary.coveredAreaCount < coverage.target.areaCount
				? [
						{
							kind: "coverage-plan" as const,
							href: `/v1/documents/measure-${measureId}.json`,
							reason: "Inspect the country-by-country gap before using a partial analysis frame.",
						},
					]
				: []),
		],
	};
};

const sourceQuery = (support: AnalysisGeographySupport, period?: string) =>
	new URLSearchParams({
		...(period === undefined ? {} : { period }),
		geography: support.source.geography,
		codeYear: String(support.source.boundaryYear),
		datasetId: support.source.datasetId,
	});

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
	const boundaryYear = parsedUrl.searchParams.get("codeYear");
	if (isPlan && (!geography || !boundaryYear))
		return invalidQuery(
			"geography and codeYear are required when planning an analysis, so the API never chooses between source partitions.",
		);
	const supports = supportFor(
		inventory,
		requestedMeasure,
		to,
		geography
			? {
					geography,
					boundaryYear,
					datasetId: parsedUrl.searchParams.get("datasetId"),
				}
			: undefined,
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
				...(supports[0]
					? planEvidence(context, supports[0], period)
					: {}),
			}),
		};
	const conversion = analysisConversion(support);
	const query = sourceQuery(support, period);
	query.set(support.path ? "path" : "crosswalk", conversion.id);
	const result = `/v1/data/${requestedMeasure}/convert?${query}`;
	const evidence = planEvidence(context, support, period, result);
	return {
		status: 200,
		body: envelope(releaseId, {
			measureId: requestedMeasure,
			period,
			analysisGeography: to,
			status: "available" as const,
			basis: "derived" as const,
			source: support.source,
			conversion,
			note: support.note,
			...evidence,
			result,
		}),
	};
};
