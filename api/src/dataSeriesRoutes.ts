import {
	isNumericObservation,
	type MeasureSource,
	type PopulationObservation,
} from "./dataCatalog";
import { analysisConversion } from "./analysisGeographies";
import { convertThroughSteps, type ConversionStep } from "./conversion";
import { buildTranslationSteps } from "./resolver/translation";
import { observationsFor } from "./observationArtifacts";
import { resolveObservations } from "./observationResolution/observationPlan";
import {
	sourceSeriesProvenance,
	type ObservationArtifactReference,
} from "./sourceExactProvenance";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

const parseAnalysisGeography = (value: string) => {
	const [geography, boundaryRelease, ...rest] = value.split("/");
	return geography && boundaryRelease && rest.length === 0
		? { geography, boundaryRelease }
		: undefined;
};

/** One area's source-exact, or explicitly reviewed derived, values over time. */
export const handleDataSeriesRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "series"
	)
		return undefined;
	const {
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	} = context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before retrieving source-exact series.",
		);
	}
	const measureId = segments[2] as string;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure) {
		return problem(
			404,
			"Not Found",
			"No published measure serves a series at that path.",
		);
	}
	const analysisGeographyValue =
		parsedUrl.searchParams.get("analysisGeography");
	if (
		parsedUrl.searchParams.has("release") ||
		parsedUrl.searchParams.has("conversion") ||
		parsedUrl.searchParams.has("aggregate")
	) {
		return problem(
			422,
			"Operation Not Supported",
			"This source-exact series endpoint does not select geometry releases, convert observations or aggregate them.",
		);
	}
	const areaCode = parsedUrl.searchParams.get("areaCode");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const datasetId = parsedUrl.searchParams.get("datasetId");
	if (!areaCode || !geography || !boundaryYear) {
		return problem(
			400,
			"Invalid Query",
			"areaCode, geography and boundaryYear are required for a source-exact series.",
		);
	}
	// A series is the whole partition rather than a moment in it, so no period
	// is asked for; the geography and, where a measure needs it, the dataset
	// are what narrow it to one.
	const resolved = resolveObservations(context, {
		measureId,
		periods: [],
		geography,
		boundaryYear,
		datasetId,
	});
	if (resolved.kind === "refusal")
		return problem(
			400,
			"Invalid Query",
			resolved.refusal.title === "Ambiguous Source"
				? "datasetId is required because more than one source matches that geography and boundary year."
				: `${measureId} has no published source for that geography, boundary year and dataset.`,
		);
	const source = resolved.plan.source;
	const observationsByPeriod = source.periods.map((period) => ({
		period,
		observations: observationsFor(measureId, source, period, {
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
		}),
	}));
	if (observationsByPeriod.some(({ observations }) => !observations)) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain every period declared by the catalogue.`,
		);
	}
	const available = observationsByPeriod as Array<{
		period: string;
		observations: ObservationArtifactReference & {
			records: PopulationObservation[];
		};
	}>;
	const firstObservations = available[0]?.observations;
	if (!firstObservations) {
		return problem(
			503,
			"Catalogue Unavailable",
			"The measure source declares no observation periods.",
		);
	}
	if (analysisGeographyValue !== null) {
		const analysisGeography = parseAnalysisGeography(
			analysisGeographyValue,
		);
		if (!analysisGeography)
			return problem(
				400,
				"Invalid Query",
				"analysisGeography must be one geography/release pair.",
			);
		const inventory = context.analysisGeographyInventory;
		if (!inventory)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the reviewed analysis geography inventory and crosswalks before retrieving an analysis series.",
			);
		const support = inventory.supports.find(
			(candidate) =>
				candidate.measureId === measureId &&
				candidate.analysisGeography.geography ===
					analysisGeography.geography &&
				candidate.analysisGeography.boundaryRelease ===
					analysisGeography.boundaryRelease &&
				candidate.source.datasetId === source.datasetId &&
				candidate.source.geography === source.sourceGeography.type &&
				candidate.source.boundaryYear ===
					source.sourceGeography.boundaryYear,
		);
		if (!support)
			return {
				status: 200,
				body: envelope(releaseId, {
					measureId,
					areaCode,
					analysisGeography,
					status: "not-comparable" as const,
					reason: "No reviewed conversion is published from the requested source partition to that analysis geography.",
				}),
			};
		// The steps are the reviewed ones the validation receipt checked: one
		// crosswalk forward, or every step of the reviewed path.
		const conversion = analysisConversion(support);
		const reviewedSteps = support.path
			? support.path.steps.map(({ crosswalk, direction }) => ({
					id: crosswalk.id,
					direction,
				}))
			: [{ id: support.crosswalk!.id, direction: "forward" as const }];
		const steps: ConversionStep[] = [];
		for (const { id, direction } of reviewedSteps) {
			const artifact = context.geographyResolver.crosswalk(id);
			if (!artifact)
				return problem(
					503,
					"Catalogue Unavailable",
					`The reviewed crosswalk ${id} is not built.`,
				);
			steps.push({
				artifact,
				direction,
				steps: buildTranslationSteps(artifact, direction),
			});
		}
		let conversionFailure: string | undefined;
		const series = available.flatMap(({ period, observations }) => {
			if (!support.source.periods.includes(period)) return [];
			if (!observations.records.every(isNumericObservation)) {
				conversionFailure = `${measureId}/${period} has non-numeric records despite its reviewed extensive conversion.`;
				return [];
			}
			const converted = convertThroughSteps(steps, observations.records);
			if (converted.status !== "converted") {
				conversionFailure = `${measureId}/${period} no longer satisfies reviewed conversion ${conversion.id}: ${converted.reason}`;
				return [];
			}
			const record = converted.records.find(
				(candidate) => candidate.areaCode === areaCode,
			);
			return record
				? [
						{
							period,
							...record,
							basis: "derived" as const,
						},
					]
				: [];
		});
		if (conversionFailure)
			return problem(503, "Catalogue Unavailable", conversionFailure);
		if (series.length === 0)
			return problem(
				404,
				"Not Found",
				"No reviewed converted observations match that analysis-area code.",
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				measure,
				areaCode,
				analysisGeography,
				status: "available" as const,
				basis: "derived" as const,
				source,
				conversion,
				provenance: {
					atlasRelease: { id: releaseId, href: "/v1/atlas-release" },
					transformation: {
						status: "applied" as const,
						note: support.path
							? "Each source-exact period was carried through every step of the reviewed path; every returned value is derived on the named analysis geography."
							: "Each source-exact period was regrouped on the reviewed crosswalk; every returned value is derived on the named analysis geography.",
					},
					source: {
						dataset: {
							id: source.datasetId,
							href: `/v1/datasets/${source.datasetId}`,
						},
						observations: {
							artifact: firstObservations.artifact,
							contentHash: firstObservations.contentHash,
							periods: support.source.periods,
						},
					},
				},
				series,
			}),
		};
	}
	const records = available.flatMap(({ period, observations }) => {
		const record = observations.records.find(
			(candidate) => candidate.areaCode === areaCode,
		);
		return record ? [{ period, ...record }] : [];
	});
	if (records.length === 0) {
		return problem(
			404,
			"Not Found",
			"No published source-exact observations match that area code.",
		);
	}
	return {
		status: 200,
		body: envelope(releaseId, {
			measure,
			source,
			areaCode,
			sourceGeography: source.sourceGeography,
			provenance: sourceSeriesProvenance({
				atlasRelease: releaseId,
				measure,
				source,
				periods: source.periods,
				observations: firstObservations,
			}),
			series: records,
		}),
	};
};
