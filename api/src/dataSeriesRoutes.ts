import type { MeasureSource, PopulationObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	sourceSeriesProvenance,
	type ObservationArtifactReference,
} from "./sourceExactProvenance";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** One area's source-exact values across every published period of a measure. */
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
	const matchingSources = measure.sources.filter(
		(source) =>
			source.sourceGeography.type === geography &&
			String(source.sourceGeography.boundaryYear) === boundaryYear &&
			(datasetId === null || source.datasetId === datasetId),
	);
	if (matchingSources.length !== 1) {
		return problem(
			400,
			"Invalid Query",
			matchingSources.length === 0
				? `${measureId} has no published source for that geography, boundary year and dataset.`
				: "datasetId is required because more than one source matches that geography and boundary year.",
		);
	}
	const source = matchingSources[0] as MeasureSource;
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
	const firstObservations = available[0]?.observations;
	if (!firstObservations) {
		return problem(
			503,
			"Catalogue Unavailable",
			"The measure source declares no observation periods.",
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
