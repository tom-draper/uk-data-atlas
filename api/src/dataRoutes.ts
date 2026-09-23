import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	canonicalValueRepresentation,
	measureUnit,
	normaliseObservation,
} from "./unitRegistry";
import { refused, resolveObservations } from "./observationResolution/observationPlan";
import {
	exportMeasureRecords,
	type MeasureExportRecord,
	type TabularFormat,
} from "./tabularExport";
import {
	sourceExactProvenance,
	type CallerSelectedGeometry,
} from "./sourceExactProvenance";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	nextPageHref,
	readPageSize,
} from "./pagination";
import { findArea } from "./areaResources";
import type { RouteRequest } from "./routing";
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
	const {
		areaLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
	} = context;
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
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	// This route documents all three as required, so a caller who leaves one
	// out is answered the same way whatever the measure. Which partition those
	// name, and whether it may be drawn on a release, is the resolver's to
	// decide rather than this route's.
	if (period === null || geography === null || boundaryYear === null) {
		return problem(
			400,
			"Invalid Query",
			`${measureId} supports only a published source period, geography and boundary year; inspect /v1/measures/${measureId} for available sources.`,
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
	const areaCode = parsedUrl.searchParams.get("areaCode");
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
	if (include === "area" && !areaLookup) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area inventory before including canonical area identities.",
		);
	}
	const observations = observationsFor(measureId, source, period as string, {
		populationObservations,
		populationLocalAuthorityObservations,
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
	const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
	if (pageSize === undefined) {
		return problem(
			400,
			"Invalid Query",
			`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
		);
	}
	const cursor = parsedUrl.searchParams.get("cursor");
	const cursorCode = cursor ? keyFromCursor(cursor) : undefined;
	if (cursor && !cursorCode) {
		return problem(400, "Invalid Query", "cursor is invalid.", {
			code: "invalid_cursor",
		});
	}
	const offset = cursorCode
		? matches.findIndex((record) => record.areaCode === cursorCode) + 1
		: 0;
	if (cursorCode && offset === 0) {
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this population query.",
			{ code: "invalid_cursor" },
		);
	}
	const records = matches.slice(offset, offset + pageSize);
	const recordsWithAreas =
		include === "area"
			? records.map((record) => {
					const area = findArea(
						areaLookup,
						source.sourceGeography.type,
						geometry?.boundaryRelease ?? "",
						record.areaCode,
					);
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
	const lastRecord = records.at(-1);
	const nextCursor =
		offset + records.length < matches.length && lastRecord
			? cursorFor(lastRecord.areaCode)
			: null;
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
				sourceGeography: source.sourceGeography,
				...(geometry === undefined ? {} : { geometry }),
				provenance,
				...(unitMode === "canonical"
					? { valueRepresentation: canonicalValueRepresentation(measure) }
					: {}),
				conversion: null,
				aggregation: null,
				records: responseRecords,
			},
			nextCursor,
		),
	};
};
