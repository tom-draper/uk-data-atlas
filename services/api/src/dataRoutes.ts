import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	canonicalValueRepresentation,
	measureUnit,
	normaliseObservation,
} from "./unitRegistry";
import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import {
	exportMeasureRecords,
	type MeasureExportRecord,
	type TabularFormat,
} from "./tabularExport";
import {
	sourceExactProvenance,
	type CallerSelectedGeometry,
} from "./sourceExactProvenance";
import { nextPageHref, paginate } from "./pagination";
import type { RouteRequest } from "./routing";
import { parsePlaceParameter, requestedGeography } from "./placeParameter";
import {
	areaNamedBy,
	defaultSource,
	namedAreaRefusal,
	publishedPartitions,
	statedDefaults,
} from "./dataDefaults";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** A measure's source-exact observations for one period, as JSON or a tabular export. */
export const handleDataRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 3 || segments[0] !== "v1" || segments[1] !== "data")
		return undefined;
	const { dataCatalog, measureObservations, measureCompatibilityInventory } =
		context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before retrieving observations.",
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
			"No published measure serves data at that path.",
		);
	}
	const place = parsePlaceParameter(parsedUrl.searchParams, measureId);
	if (place && "status" in place) return place;
	if (place?.kind === "location")
		return problem(
			400,
			"Invalid Query",
			`This table lists a partition's areas as published, and a curated location is not one of them. /v1/data/${measureId}/aggregate sums it from its members.`,
		);
	const placeText = parsedUrl.searchParams.get("place")?.trim() ?? null;
	const named = areaNamedBy({
		geographyResolver: context.geographyResolver,
		measure,
		place: placeText,
		geography: requestedGeography(parsedUrl.searchParams, place),
		boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
	});
	const namedRefusal = namedAreaRefusal({
		parsedUrl,
		measure,
		parameter: "place",
		text: placeText,
		named,
	});
	if (namedRefusal) return namedRefusal;
	const area = named?.kind === "area" ? named : undefined;
	const requested = {
		period: parsedUrl.searchParams.get("period"),
		geography:
			requestedGeography(parsedUrl.searchParams, place) ??
			area?.geography ??
			null,
		boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
		datasetId: parsedUrl.searchParams.get("datasetId"),
	};
	const defaults = defaultSource(measure, requested);
	const period = requested.period ?? defaults?.period ?? null;
	const geography = requested.geography ?? defaults?.geography ?? null;
	const boundaryYear =
		requested.boundaryYear ?? defaults?.boundaryYear ?? null;
	// Which partition these name, and whether it may be drawn on a release,
	// is the resolver's to decide rather than this route's.
	if (period === null || geography === null || boundaryYear === null) {
		return problem(
			400,
			"Invalid Query",
			`${measureId} lists the areas of one source partition, and this query does not pick one: give geography, with boundaryYear or datasetId where it has several, and a period that partition publishes. Published partitions: ${publishedPartitions(measure)}.`,
		);
	}
	const requestedRelease = parsedUrl.searchParams.get("release");
	if (requestedRelease && !measureCompatibilityInventory) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build measure compatibility before selecting a geometry release for observations.",
		);
	}
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
		release: requestedRelease,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source, join } = resolved.plan;
	const geometry: CallerSelectedGeometry | undefined = join && {
		boundaryRelease: join.boundaryRelease,
		selection: "caller-specified",
		compatibility: join.compatibility,
		areaIdentityTemplate: `${source.sourceGeography.type}/${join.boundaryRelease}/{areaCode}`,
		note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
	};
	if (
		parsedUrl.searchParams.has("conversion") ||
		parsedUrl.searchParams.has("aggregate")
	) {
		return problem(
			422,
			"Operation Not Supported",
			"This source-exact endpoint does not yet convert observations or aggregate them.",
		);
	}
	const areaCode = area?.code ?? place?.code;
	const include = parsedUrl.searchParams.get("include");
	const requestedFormat = parsedUrl.searchParams.get("format") ?? "json";
	const unitMode = parsedUrl.searchParams.get("units") ?? "source";
	if (
		requestedFormat !== "json" &&
		requestedFormat !== "csv" &&
		requestedFormat !== "ndjson"
	) {
		return problem(
			400,
			"Invalid Query",
			"format must be one of json, csv or ndjson.",
			{ code: "invalid_format" },
		);
	}
	if (unitMode !== "source" && unitMode !== "canonical") {
		return problem(
			400,
			"Invalid Query",
			"units must be source or canonical.",
		);
	}
	if (unitMode === "canonical" && requestedFormat !== "json") {
		return problem(
			422,
			"Operation Not Supported",
			"Canonical unit values are currently available in the JSON representation only.",
		);
	}
	if (measure.valueKind === "categorical" && requestedFormat !== "json") {
		return problem(
			422,
			"Operation Not Supported",
			"Tabular exports currently support numeric measures only; request JSON for categorical observations.",
		);
	}
	if (include !== null && include !== "area") {
		return problem(
			400,
			"Invalid Query",
			"include currently supports only area.",
		);
	}
	if (include === "area" && !geometry) {
		return problem(
			400,
			"Invalid Query",
			"include=area requires a caller-selected compatible release.",
		);
	}
	if (include === "area") {
		const unavailable = context.geographyResolver.requires("areas");
		if (unavailable) return unavailable;
	}
	const observations = observationsFor(measureId, source, period as string, {
		measureObservations,
	});
	if (!observations) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	}
	const sourceRecords = observations.records;
	if (
		unitMode === "canonical" &&
		!sourceRecords.every(isNumericObservation)
	) {
		return problem(
			422,
			"Operation Not Supported",
			"Categorical observations have no numeric unit value to normalise.",
		);
	}
	const canonicalUnit =
		unitMode === "canonical" ? measureUnit(measure) : undefined;
	const provenance = sourceExactProvenance({
		atlasRelease: releaseId,
		measure,
		source,
		period: period as string,
		observations,
		geometry,
	});
	const matches = areaCode
		? sourceRecords.filter((record) => record.areaCode === areaCode)
		: sourceRecords;
	const page = paginate(parsedUrl, matches, {
		keyOf: (record) => record.areaCode,
		subject: `${measureId} query`,
	});
	if ("problem" in page) return page.problem;
	const { items: records, nextCursor } = page;
	const recordsWithAreas =
		include === "area"
			? records.map((record) => {
					const area = context.geographyResolver.area({
						geography: source.sourceGeography.type,
						boundaryRelease: geometry?.boundaryRelease ?? "",
						code: record.areaCode,
					});
					if (!area) return undefined;
					return {
						...record,
						area: {
							id: `${source.sourceGeography.type}/${geometry?.boundaryRelease}/${area.code}`,
							...area,
						},
					};
				})
			: records;
	if (recordsWithAreas.some((record) => record === undefined)) {
		return problem(
			503,
			"Catalogue Unavailable",
			"The selected release is compatible but its compiled area inventory is incomplete.",
		);
	}
	const resolvedRecords = recordsWithAreas.filter(
		(record) => record !== undefined,
	);
	const responseRecords = canonicalUnit
		? resolvedRecords.map((record) => {
				// The complete source partition was checked above. Retain this
				// guard for TypeScript and for an area-enrichment regression.
				if (!isNumericObservation(record))
					throw new Error(
						"A canonical unit representation was requested for a categorical record.",
					);
				return normaliseObservation(record, canonicalUnit);
			})
		: resolvedRecords;
	const exportRecords = resolvedRecords.filter(
		(record): record is MeasureExportRecord => isNumericObservation(record),
	);
	if (requestedFormat !== "json") {
		const exported = exportMeasureRecords(
			requestedFormat as TabularFormat,
			{
				atlasRelease: releaseId,
				measureId: measure.id,
				unit: measure.unit,
				source,
				period: period as string,
				geometry,
				records: exportRecords,
			},
		);
		return {
			status: 200,
			body: envelope(
				releaseId,
				{
					format: requestedFormat,
					rowCount: exportRecords.length,
					...statedDefaults(defaults?.defaulted),
				},
				nextCursor,
			),
			representation: {
				...exported,
				// A tabular body carries no envelope, so the only way a
				// caller can tell a page from the whole partition is the
				// link relation. Without it an export silently stops at
				// the page size.
				headers: nextCursor
					? {
							link: `<${nextPageHref(parsedUrl, nextCursor)}>; rel="next"`,
						}
					: {},
			},
		};
	}
	return {
		status: 200,
		body: envelope(
			releaseId,
			{
				measure,
				source,
				period,
				...statedDefaults(defaults?.defaulted),
				sourceGeography: source.sourceGeography,
				...(geometry === undefined ? {} : { geometry }),
				provenance,
				...(unitMode === "canonical"
					? {
							valueRepresentation:
								canonicalValueRepresentation(measure),
						}
					: {}),
				conversion: null,
				aggregation: null,
				records: responseRecords,
			},
			nextCursor,
		),
	};
};
