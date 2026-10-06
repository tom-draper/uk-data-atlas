import { compareObservations } from "./comparison";
import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { sourceExactProvenance } from "./sourceExactProvenance";
import {
	areaNamedBy,
	defaultSource,
	namedAreaRefusal,
	publishedPartitions,
	statedDefaults,
	type NamedArea,
} from "./dataDefaults";

/** Operations that compare or transform source-exact observations. */
export const handleDataTransformRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "compare"
	)
		return undefined;
	const { dataCatalog, measureObservations } = context;
	if (!dataCatalog)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before comparing source-exact observations.",
		);
	const measureId = segments[2]!;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure serves comparisons at that path.",
		);
	if (measure.valueKind === "categorical")
		return problem(
			422,
			"Operation Not Supported",
			"Categorical measures have no numeric difference to compare.",
		);
	if (
		["release", "conversion", "aggregate"].some((parameter) =>
			parsedUrl.searchParams.has(parameter),
		)
	)
		return problem(
			422,
			"Operation Not Supported",
			"This source-exact comparison endpoint does not select geometry releases, convert observations or aggregate them.",
		);
	const requestedGeography = parsedUrl.searchParams.get("geography");
	const baselineAreaCodeParameter =
		parsedUrl.searchParams.get("baselineAreaCode");
	const comparisonAreaCodeParameter =
		parsedUrl.searchParams.get("comparisonAreaCode");
	const nameArea = (text: string | null, geography: string | null) =>
		areaNamedBy({
			geographyResolver: context.geographyResolver,
			measure,
			place: text,
			geography,
			boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
		});
	const baselineNamed = nameArea(
		baselineAreaCodeParameter,
		requestedGeography,
	);
	const comparisonNamed = nameArea(
		comparisonAreaCodeParameter,
		requestedGeography,
	);
	// A name that means several areas is read in the other area's geography
	// when that one is clear, so "Newport" against "Cardiff" is the council.
	const inGeographyOf = (
		text: string | null,
		named: NamedArea | undefined,
		other: NamedArea | undefined,
	) => {
		if (named?.kind !== "ambiguous" || other?.kind !== "area") return named;
		const narrowed = nameArea(text, other.geography);
		return narrowed?.kind === "area" ? narrowed : named;
	};
	const baselinePlace = inGeographyOf(
		baselineAreaCodeParameter,
		baselineNamed,
		comparisonNamed,
	);
	const comparisonPlace = inGeographyOf(
		comparisonAreaCodeParameter,
		comparisonNamed,
		baselineNamed,
	);
	for (const [parameter, text, named] of [
		["baselineAreaCode", baselineAreaCodeParameter, baselinePlace],
		["comparisonAreaCode", comparisonAreaCodeParameter, comparisonPlace],
	] as const) {
		const refusal = namedAreaRefusal({
			parsedUrl,
			measure,
			parameter,
			text,
			named,
		});
		if (refusal) return refusal;
	}
	const baselineArea =
		baselinePlace?.kind === "area" ? baselinePlace : undefined;
	const comparisonArea =
		comparisonPlace?.kind === "area" ? comparisonPlace : undefined;
	const inferredGeography =
		baselineArea?.geography === comparisonArea?.geography
			? (baselineArea?.geography ?? null)
			: null;
	const requested = {
		period: parsedUrl.searchParams.get("period"),
		geography: requestedGeography ?? inferredGeography,
		boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
		datasetId: parsedUrl.searchParams.get("datasetId"),
	};
	const defaults = defaultSource(measure, requested);
	const period = requested.period ?? defaults?.period ?? null;
	const geography = requested.geography ?? defaults?.geography ?? null;
	const boundaryYear =
		requested.boundaryYear ?? defaults?.boundaryYear ?? null;
	const baselineAreaCode = baselineArea?.code ?? baselineAreaCodeParameter;
	const comparisonAreaCode =
		comparisonArea?.code ?? comparisonAreaCodeParameter;
	if (!baselineAreaCode || !comparisonAreaCode)
		return problem(
			400,
			"Invalid Query",
			"baselineAreaCode and comparisonAreaCode are required.",
		);
	if (baselineAreaCode === comparisonAreaCode)
		return problem(
			400,
			"Invalid Query",
			"baselineAreaCode and comparisonAreaCode must differ.",
		);
	if (period === null || geography === null || boundaryYear === null)
		return problem(
			400,
			"Invalid Query",
			`${measureId} compares two areas within one source partition, and this query does not pick one: give geography, with boundaryYear or datasetId where it has several, and a period that partition publishes. Published partitions: ${publishedPartitions(measure)}.`,
		);
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source } = resolved.plan;
	const observations = observationsFor(measureId, source, period!, {
		measureObservations,
	});
	if (!observations)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	const numericRecords = observations.records.filter(isNumericObservation);
	if (numericRecords.length !== observations.records.length)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for comparison.`,
		);
	const baseline = numericRecords.find(
		(record) => record.areaCode === baselineAreaCode,
	);
	const comparison = numericRecords.find(
		(record) => record.areaCode === comparisonAreaCode,
	);
	if (!baseline || !comparison)
		return problem(
			404,
			"Not Found",
			"One or both requested area codes have no published source-exact observation.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			measure,
			source,
			period,
			...statedDefaults(defaults?.defaulted),
			sourceGeography: source.sourceGeography,
			provenance: sourceExactProvenance({
				atlasRelease: releaseId,
				measure,
				source,
				period: period!,
				observations,
			}),
			comparison: compareObservations(measure, baseline, comparison),
		}),
	};
};
