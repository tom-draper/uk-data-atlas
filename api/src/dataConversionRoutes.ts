import type { CrosswalkArtifact } from "./crosswalkInventory";
import { isNumericObservation } from "./dataCatalog";
import type { RelationshipPath } from "./relationshipPaths";
import { buildTranslationSteps } from "./resolver/translation";
import { observationsFor } from "./observationArtifacts";
import { refused, resolveObservations } from "./resolve/observationPlan";
import { statisticPhrase } from "./aggregation";
import { convertThroughSteps, type ConversionStep } from "./conversion";
import { sourceExactProvenance } from "./sourceExactProvenance";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

const crosswalkSummary = (artifact: CrosswalkArtifact) => ({
	id: artifact.id,
	href: `/v1/crosswalks/${artifact.id}`,
	method: artifact.method,
	quality: artifact.quality,
	weighting: artifact.weighting,
	contentHash: artifact.contentHash,
});

/**
 * Observations regrouped onto another geography through one caller-selected
 * crosswalk, or through every step of a caller-selected published path.
 */
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
		geographyResolver,
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
	// A conversion regroups values onto the crosswalk's target areas, so it
	// has no geometry release to select: passing one would read as a promise
	// that the targets are drawn from it.
	if (parsedUrl.searchParams.has("release")) {
		return problem(
			422,
			"Operation Not Supported",
			"This conversion does not select a geometry release. The crosswalk names the target areas, and /v1/data/{measure-id} joins a compatible release for a map.",
		);
	}
	const crosswalkId = parsedUrl.searchParams.get("crosswalk");
	const pathId = parsedUrl.searchParams.get("path");
	if (crosswalkId && pathId)
		return problem(
			400,
			"Invalid Query",
			"Name either crosswalk or path, not both. A path already names every crosswalk it uses.",
		);
	if (!crosswalkId && !pathId)
		return problem(
			400,
			"Invalid Query",
			"crosswalk or path is required. This route never selects a conversion path for the caller; /v1/crosswalks lists the published crosswalks and /v1/relationship-paths the published paths.",
		);
	// Either way the caller names the route: one crosswalk forward, or every
	// step of a published relationship path.
	let route: {
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		steps: ConversionStep[];
		path?: RelationshipPath;
	};
	if (crosswalkId) {
		const artifact = crosswalkLookup.get(crosswalkId);
		if (!artifact)
			return problem(
				404,
				"Not Found",
				"No published crosswalk matches that id.",
			);
		route = {
			from: artifact.from,
			to: artifact.to,
			steps: [
				{
					artifact,
					direction: "forward",
					steps: buildTranslationSteps(artifact, "forward"),
				},
			],
		};
	} else {
		const path = geographyResolver?.relationshipPath(pathId!);
		if (!path)
			return problem(
				404,
				"Not Found",
				"No published relationship path matches that id.",
			);
		const indexed = geographyResolver!.indexedPathSteps(path);
		if ("missingCrosswalkId" in indexed)
			return problem(
				503,
				"Catalogue Unavailable",
				`The crosswalk ${indexed.missingCrosswalkId} required by path ${path.id} is not built.`,
			);
		route = { from: path.from, to: path.to, steps: indexed.steps, path };
	}
	const period = parsedUrl.searchParams.get("period");
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	// The three are documented as required here, so a caller who leaves one out
	// is answered the same way whatever the measure. Which partition they name
	// is the resolver's to decide.
	if (period === null || geography === null || boundaryYear === null)
		return problem(
			400,
			"Invalid Query",
			`${measureId} has no published source for that period, geography and boundary year.`,
		);
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source } = resolved.plan;
	if (route.from.geography !== source.sourceGeography.type) {
		return problem(
			422,
			"Operation Not Supported",
			`That ${route.path ? "path" : "crosswalk"} starts at ${route.from.geography}, but this source partition is published on ${source.sourceGeography.type} areas.`,
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
	const converted = convertThroughSteps(route.steps, numericRecords);
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
		return problem(400, "Invalid Query", "cursor is invalid.", {
			code: "invalid_cursor",
		});
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
			{ code: "invalid_cursor" },
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
					type: route.to.geography,
					boundaryRelease: route.to.boundaryRelease,
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
						note: route.path
							? "Input observations are source-exact; the values below were carried through every step of the named path onto its target areas."
							: "Input observations are source-exact; the values below were regrouped onto the crosswalk's target areas.",
					},
				},
				conversion: {
					...(route.path
						? {
								path: {
									id: route.path.id,
									purpose: route.path.purpose,
									origin: route.path.origin,
									quality: route.path.quality,
									steps: route.steps.map(({ artifact, direction }) => ({
										direction,
										crosswalk: crosswalkSummary(artifact),
									})),
								},
							}
						: { crosswalk: crosswalkSummary(route.steps[0]!.artifact) }),
					method: converted.method,
					inputRecordCount: converted.inputRecordCount,
					outputRecordCount: converted.records.length,
					note:
						converted.method === "exact"
							? "Every source area sits wholly within one target, so this is a regrouping and the partition total is unchanged."
							: converted.method === "population-weighted"
								? "Sources split across targets were apportioned by where their residents live, counted from the crosswalk's population building blocks. This is an estimate: it assumes the measure follows resident population."
								: "Sources split across targets were apportioned by overlapping area. This is an estimate: it assumes the measure is spread evenly across each source area.",
				},
				aggregation: null,
				records: page,
			},
			nextCursor,
		),
	};
};
