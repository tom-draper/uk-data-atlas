import { publicSeriesMeasure } from "../dimensions/publicSeriesMeasure.ts";
import { isNumericObservation } from "@uk-data-atlas/catalogue/node";
import { analysisConversion } from "@uk-data-atlas/relationships";
import {
	convertThroughSteps,
	type ConversionStep,
} from "@uk-data-atlas/measures";
import { buildTranslationSteps } from "@uk-data-atlas/relationships";
import { observationsFor } from "@uk-data-atlas/catalogue/node";
import { parseExactReleaseReference } from "@uk-data-atlas/areas";
import {
	areaNamedBy,
	namedAreaRefusal,
	publishedPartitions,
	statedDefaults,
} from "./dataDefaults";
import { selectSourcePartition } from "./sourcePartition";
import { releaseSeriesResponse } from "./releaseSeries.ts";
import { sourceSeriesProvenance } from "./sourceExactProvenance.ts";
import type { RouteRequestFor } from "../runtime/index.ts";
import { parsePlaceParameter, requestedGeography } from "./placeParameter";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "../runtime/index.ts";

/** One area's source-exact, or explicitly reviewed derived, values over time. */
export const handleDataSeriesRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
	series: selectedSeries,
}: RouteRequestFor<"crosswalk" | "places">): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "series"
	)
		return undefined;
	const { dataCatalog, measureObservations } = context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before retrieving source-exact series.",
		);
	}
	const measureId =
		selectedSeries?.catalogueMeasure.id ?? (segments[2] as string);
	const measure =
		selectedSeries?.catalogueMeasure ??
		dataCatalog.measures.find((candidate) => candidate.id === measureId);
	if (!measure) {
		return problem(
			404,
			"Not Found",
			"No published measure serves a series at that path.",
		);
	}
	const toParameter = parsedUrl.searchParams.get("to");
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
	const place = parsePlaceParameter(parsedUrl.searchParams, segments[2]!);
	if (place && "status" in place) return place;
	if (place?.kind === "location")
		return invalidQuery(
			`A series is one area's. A curated location is summed from its members by /v1/data/${segments[2]}/value, or answered by /v1/data/${segments[2]}/value?place=${encodeURIComponent(`location/${place.id}`)}.`,
		);
	const placeText = parsedUrl.searchParams.get("place")?.trim() ?? null;
	const named = areaNamedBy({
		geographyResolver: context.geographyResolver,
		measure,
		place: placeText,
		geography: requestedGeography(parsedUrl.searchParams, place),
		boundaryYear: parsedUrl.searchParams.get("codeYear"),
	});
	const namedRefusal = namedAreaRefusal({
		parsedUrl,
		measure,
		publicId: segments[2],
		series: selectedSeries,
		parameter: "place",
		text: placeText,
		named,
	});
	if (namedRefusal) return namedRefusal;
	const area = named?.kind === "area" ? named : undefined;
	const areaCode = area?.code ?? place?.code;
	const onParameter = parsedUrl.searchParams.get("on");
	if (onParameter !== null) {
		if (toParameter !== null)
			return invalidQuery(
				"Give on= for a series rebuilt on one boundary release, or to= for a reviewed analysis geography, not both.",
			);
		const on = parseExactReleaseReference(onParameter);
		if (!on)
			return invalidQuery(
				"on must be one geography/release pair, such as localAuthority/2026-05-uk-bgc.",
			);
		if (!areaCode)
			return invalidQuery(
				"place is required: an area code on that release, or a place reference such as localAuthority/E08000035.",
			);
		return releaseSeriesResponse({
			context,
			releaseId,
			measure,
			selectedSeries,
			publicId: segments[2]!,
			publicMeasure: publicSeriesMeasure(
				measure,
				selectedSeries,
				segments[2]!,
				dataCatalog,
				context.measureDimensions,
			),
			areaCode,
			on,
			datasetId: parsedUrl.searchParams.get("datasetId"),
		});
	}
	const requested = {
		geography:
			requestedGeography(parsedUrl.searchParams, place) ??
			area?.geography ??
			null,
		boundaryYear: parsedUrl.searchParams.get("codeYear"),
		datasetId: parsedUrl.searchParams.get("datasetId"),
	};
	const partition = selectSourcePartition({
		context,
		measure,
		query: requested,
		periods: [],
		includePeriod: false,
	});
	const geography = partition.kind === "refusal" ? null : partition.geography;
	const boundaryYear =
		partition.kind === "refusal" ? null : partition.boundaryYear;
	const datasetId = parsedUrl.searchParams.get("datasetId");
	if (
		!areaCode ||
		partition.kind === "incomplete" ||
		!geography ||
		!boundaryYear
	) {
		return invalidQuery(
			areaCode
				? `${segments[2]} is published on more than one partition, so give geography and boundaryYear, or a place reference such as localAuthority/E08000035 that carries its geography. Published partitions: ${publishedPartitions(measure)}.`
				: "place is required: an area name, an area code, or a place reference such as localAuthority/E08000035.",
		);
	}
	// A series is the whole partition rather than a moment in it, so no period
	// is asked for; the geography and, where a measure needs it, the dataset
	// are what narrow it to one.
	if (partition.kind === "refusal")
		return invalidQuery(
			partition.resolution.refusal.title === "Ambiguous Source"
				? "datasetId is required because more than one source matches that geography and boundary year."
				: `${segments[2]} has no published source for that geography, boundary year and dataset.`,
		);
	const {
		defaults,
		plan: { source },
	} = partition;
	const available: Array<{
		period: string;
		observations: NonNullable<ReturnType<typeof observationsFor>>;
	}> = [];
	for (const period of source.periods) {
		const observations = observationsFor(measureId, source, period, {
			measureObservations,
			seriesKey: selectedSeries?.id,
			indexed: true,
		});
		if (!observations)
			return problem(
				503,
				"Catalogue Unavailable",
				`The observation artifact for ${segments[2]} does not contain every period declared by the catalogue.`,
			);
		available.push({ period, observations });
	}
	const firstObservations = available[0]?.observations;
	if (!firstObservations) {
		return problem(
			503,
			"Catalogue Unavailable",
			"The measure source declares no observation periods.",
		);
	}
	const publicMeasure = publicSeriesMeasure(
		measure,
		selectedSeries,
		segments[2]!,
		dataCatalog,
		context.measureDimensions,
	);
	if (toParameter !== null) {
		const analysisGeography = parseExactReleaseReference(toParameter);
		if (!analysisGeography)
			return invalidQuery("to must be one geography/release pair.");
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
					measureId: segments[2]!,
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
				conversionFailure = `${segments[2]}/${period} has non-numeric records despite its reviewed extensive conversion.`;
				return [];
			}
			const converted = convertThroughSteps(steps, observations.records);
			if (converted.status !== "converted") {
				conversionFailure = `${segments[2]}/${period} no longer satisfies reviewed conversion ${conversion.id}: ${converted.reason}`;
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
				measure: publicMeasure,
				areaCode,
				...statedDefaults(defaults?.defaulted),
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
		const record = observations.recordFor(areaCode);
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
			measure: publicMeasure,
			source,
			areaCode,
			...statedDefaults(defaults?.defaulted),
			sourceGeography: source.sourceGeography,
			provenance: sourceSeriesProvenance({
				atlasRelease: releaseId,
				measure: publicMeasure,
				source,
				periods: source.periods,
				observations: firstObservations,
			}),
			series: records,
		}),
	};
};
