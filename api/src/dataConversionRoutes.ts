import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import { statisticPhrase } from "./aggregation";
import { convertObservations } from "./conversion";
import { sourceExactProvenance } from "./sourceExactProvenance";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** Observations regrouped onto another geography through one caller-selected crosswalk. */
export const handleDataConversionRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "convert"
	)
		return undefined;
	const {
		crosswalkLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	} = context;
	if (!dataCatalog || !crosswalkLookup) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and crosswalks before converting observations.",
		);
	}
	const measureId = segments[2] as string;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure serves conversion at that path.",
		);
	// A ratio cannot be regrouped by adding it up, and area weighting a
	// share or a rank produces a number with no meaning.
	if (measure.aggregation.kind !== "extensive") {
		return problem(
			422,
			"Operation Not Supported",
			measure.aggregation.kind === "non-aggregatable"
				? `Only an extensive measure can be converted across releases. This measure is ${statisticPhrase(measure.aggregation.statistic)}: ${measure.aggregation.note}`
				: "Only an extensive measure can be converted across releases; this measure's values do not add over areas.",
			{ code: "aggregation_not_supported" },
		);
	}
	const crosswalkId = parsedUrl.searchParams.get("crosswalk");
	if (!crosswalkId)
		return problem(
			400,
			"Invalid Query",
			"crosswalk is required. This route never selects a conversion path for the caller; /v1/crosswalks lists the published ones.",
		);
	const artifact = crosswalkLookup.get(crosswalkId);
	if (!artifact)
		return problem(
			404,
			"Not Found",
			"No published crosswalk matches that id.",
		);
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const source = measure.sources.find(
		(candidate) =>
			candidate.periods.includes(period ?? "") &&
			candidate.sourceGeography.type === geography &&
			String(candidate.sourceGeography.boundaryYear) === boundaryYear,
	);
	if (!source)
		return problem(
			400,
			"Invalid Query",
			`${measureId} has no published source for that period, geography and boundary year.`,
		);
	if (artifact.from.geography !== source.sourceGeography.type) {
		return problem(
			422,
			"Operation Not Supported",
			`That crosswalk starts at ${artifact.from.geography}, but this source partition is published on ${source.sourceGeography.type} areas.`,
			{
				code: "conversion_not_available",
				absence: "crosswalk-geography-mismatch",
			},
		);
	}
	const observations = observationsFor(measureId, source, period as string, {
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	});
	if (!observations)
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	const numericRecords = observations.records.filter(isNumericObservation);
	if (numericRecords.length !== observations.records.length) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for conversion.`,
		);
	}
	const converted = convertObservations(artifact, numericRecords);
	if (converted.status === "refused") {
		return problem(422, "Operation Not Supported", converted.reason, {
			code: "conversion_not_available",
			absence: converted.absence,
			areaCount: converted.areaCount,
			areaSample: converted.areaSample,
		});
	}
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
	if (cursor && !cursorCode)
		return problem(400, "Invalid Query", "cursor is invalid.");
	const offset = cursorCode
		? converted.records.findIndex(
				(record) => record.areaCode === cursorCode,
			) + 1
		: 0;
	if (cursorCode && offset === 0)
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this conversion.",
		);
	const page = converted.records.slice(offset, offset + pageSize);
	const lastRecord = page.at(-1);
	const nextCursor =
		offset + page.length < converted.records.length && lastRecord
			? cursorFor(lastRecord.areaCode)
			: null;
	return {
		status: 200,
		body: envelope(
			releaseId,
			{
				measure,
				source,
				period,
				sourceGeography: source.sourceGeography,
				targetGeography: {
					type: artifact.to.geography,
					boundaryRelease: artifact.to.boundaryRelease,
				},
				provenance: {
					...sourceExactProvenance({
						atlasRelease: releaseId,
						measure,
						source,
						period: period as string,
						observations,
					}),
					transformation: {
						status: "applied" as const,
						note: "Input observations are source-exact; the values below were regrouped onto the crosswalk's target areas.",
					},
				},
				conversion: {
					crosswalk: {
						id: artifact.id,
						href: `/v1/crosswalks/${artifact.id}`,
						method: artifact.method,
						quality: artifact.quality,
						weighting: artifact.weighting,
						contentHash: artifact.contentHash,
					},
					method: converted.method,
					inputRecordCount: converted.inputRecordCount,
					outputRecordCount: converted.records.length,
					note:
						converted.method === "exact"
							? "Every source area sits wholly within one target, so this is a regrouping and the partition total is unchanged."
							: "Sources split across targets were apportioned by overlapping area. This is an estimate: it assumes the measure is spread evenly across each source area.",
				},
				aggregation: null,
				records: page,
			},
			nextCursor,
		),
	};
};
