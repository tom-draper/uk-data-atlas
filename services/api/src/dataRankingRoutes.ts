import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import {
	refused,
	resolveObservations,
} from "./observationResolution/observationPlan";
import { rankObservations, readRankingOrder } from "./ranking";
import { sourceExactProvenance } from "./sourceExactProvenance";
import {
	defaultSource,
	publishedPartitions,
	statedDefaults,
} from "./dataDefaults";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** Source-exact observations for one period, ranked with ties shared, in stable pages. */
export const handleDataRankingRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "rankings"
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
			"Build the data catalogue before retrieving source-exact rankings.",
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
			"No published measure serves rankings at that path.",
		);
	}
	if (measure.valueKind === "categorical") {
		return problem(
			422,
			"Operation Not Supported",
			"Categorical measures have no numeric order to rank.",
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
			"This source-exact ranking endpoint does not select geometry releases, convert observations or aggregate them.",
		);
	}
	const requested = {
		period: parsedUrl.searchParams.get("period"),
		geography: parsedUrl.searchParams.get("geography"),
		boundaryYear: parsedUrl.searchParams.get("boundaryYear"),
		datasetId: parsedUrl.searchParams.get("datasetId"),
	};
	const defaults = defaultSource(measure, requested);
	const period = requested.period ?? defaults?.period ?? null;
	const geography = requested.geography ?? defaults?.geography ?? null;
	const boundaryYear =
		requested.boundaryYear ?? defaults?.boundaryYear ?? null;
	if (period === null || geography === null || boundaryYear === null)
		return problem(
			400,
			"Invalid Query",
			`${measureId} ranks areas within one source partition, and this query does not pick one: give geography, with boundaryYear or datasetId where it has several, and a period that partition publishes. Published partitions: ${publishedPartitions(measure)}.`,
		);
	const resolved = resolveObservations(context, {
		measureId,
		periods: [period],
		geography,
		boundaryYear,
	});
	if (resolved.kind === "refusal") return refused(resolved.refusal);
	const { source } = resolved.plan;
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
	const numericRecords = observations.records.filter(isNumericObservation);
	if (numericRecords.length !== observations.records.length) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for ranking.`,
		);
	}
	const order = readRankingOrder(parsedUrl.searchParams.get("order"));
	if (!order) {
		return problem(400, "Invalid Query", "order must be asc or desc.");
	}
	const ranked = rankObservations(numericRecords, order);
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
		? ranked.findIndex((record) => record.areaCode === cursorCode) + 1
		: 0;
	if (cursorCode && offset === 0) {
		return problem(
			400,
			"Invalid Query",
			"cursor is not valid for this ranking query.",
			{ code: "invalid_cursor" },
		);
	}
	const records = ranked.slice(offset, offset + pageSize);
	const lastRecord = records.at(-1);
	const nextCursor =
		offset + records.length < ranked.length && lastRecord
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
				...statedDefaults(defaults?.defaulted),
				sourceGeography: source.sourceGeography,
				provenance: sourceExactProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					period: period as string,
					observations,
				}),
				ranking: {
					order,
					method: "competition",
					note: "Equal values share a rank; the following rank accounts for every preceding observation (for example 1, 1, 3).",
				},
				records,
			},
			nextCursor,
		),
	};
};
