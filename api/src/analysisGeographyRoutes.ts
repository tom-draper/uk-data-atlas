import { analysisConversion } from "./analysisGeographies";
import { unsupported } from "./capability";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const parseAnalysisGeography = (value: string | null) => {
	if (!value) return undefined;
	const [geography, boundaryRelease, ...rest] = value.split("/");
	return geography && boundaryRelease && rest.length === 0
		? { geography, boundaryRelease }
		: undefined;
};

const supportFor = (
	inventory: NonNullable<RouteRequest["context"]["analysisGeographyInventory"]>,
	measureId: string,
	analysisGeography: { geography: string; boundaryRelease: string },
	source?: { geography: string; boundaryYear: string | null },
) =>
	inventory.supports.filter(
		(support) =>
			support.measureId === measureId &&
			support.analysisGeography.geography === analysisGeography.geography &&
			support.analysisGeography.boundaryRelease === analysisGeography.boundaryRelease &&
			(source === undefined ||
				(support.source.geography === source.geography &&
					String(support.source.boundaryYear) === source.boundaryYear)),
	);

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
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "analysis-geography-validation"
	) {
		return validation
			? { status: 200, body: envelope(releaseId, validation) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the analysis geography validation inventory before retrieving its receipt.",
				);
	}
	if (!inventory)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the analysis geography inventory before planning an analysis.",
		);
	if (segments.length === 2 && segments[0] === "v1" && segments[1] === "analysis-geographies") {
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
		segments.length === 2 && segments[0] === "v1" && segments[1] === "analysis:plan";
	if (!isConversionSupport && !isPlan) return undefined;
	const requestedMeasure = isPlan
		? parsedUrl.searchParams.get("measure")
		: measureId;
	const analysisGeography = parseAnalysisGeography(
		parsedUrl.searchParams.get("analysisGeography"),
	);
	if (!requestedMeasure || !analysisGeography)
		return problem(
			400,
			"Invalid Query",
			"measure and analysisGeography=geography/release are required.",
		);
	const sourceGeography = parsedUrl.searchParams.get("sourceGeography");
	const sourceBoundaryYear = parsedUrl.searchParams.get("sourceBoundaryYear");
	if (isPlan && (!sourceGeography || !sourceBoundaryYear))
		return problem(
			400,
			"Invalid Query",
			"sourceGeography and sourceBoundaryYear are required when planning an analysis, so the API never chooses between source partitions.",
		);
	const supports = supportFor(
		inventory,
		requestedMeasure,
		analysisGeography,
		sourceGeography ? { geography: sourceGeography, boundaryYear: sourceBoundaryYear } : undefined,
	);
	if (!isPlan)
		return {
			status: 200,
			body: envelope(releaseId, {
				measureId: requestedMeasure,
				analysisGeography,
				...(supports.length > 0
					? { status: "available" as const, supports }
					: unsupported(
						`No reviewed conversion is published for ${requestedMeasure} on ${analysisGeography.geography}/${analysisGeography.boundaryRelease}.`,
					)),
			}),
		};
	const period = parsedUrl.searchParams.get("period");
	if (!period)
		return problem(400, "Invalid Query", "period is required when planning an analysis.");
	const support = supports.find((candidate) => candidate.source.periods.includes(period));
	if (!support)
		return {
			status: 200,
			body: envelope(releaseId, {
				measureId: requestedMeasure,
				period,
				analysisGeography,
				status: "not-comparable" as const,
				reason:
					supports.length > 0
						? `${period} is not published by the requested source partition; supported periods are ${supports.flatMap((candidate) => candidate.source.periods).join(", ")}.`
						: `No reviewed conversion is published from ${sourceGeography}/${sourceBoundaryYear} to ${analysisGeography.geography}/${analysisGeography.boundaryRelease} for ${requestedMeasure}.`,
			}),
		};
	return {
		status: 200,
		body: envelope(releaseId, {
			measureId: requestedMeasure,
			period,
			analysisGeography,
			status: "available" as const,
			basis: "derived" as const,
			source: support.source,
			conversion: analysisConversion(support),
			note: support.note,
			result: `/v1/data/${requestedMeasure}/convert?period=${encodeURIComponent(period)}&geography=${support.source.geography}&boundaryYear=${support.source.boundaryYear}&${support.path ? "path" : "crosswalk"}=${encodeURIComponent(analysisConversion(support).id)}`,
		}),
	};
};
