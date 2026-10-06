import {
	CONTAINMENT_NOTE,
	describeLookupRelease,
	locatePoints,
	parseLookupRequest,
	type LookupPoint,
	type PointResult,
} from "./pointLookup";
import {
	compactPostcode,
	parsePostcode,
	postcodeLookupPoint,
	type PostcodeRecord,
	type PostcodeSource,
} from "./postcodes";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import { readBatchInput } from "./batchInput";
import type { RouteRequest } from "./routing";

/** The areas a postcode is placed in when a caller names none. */
export const DEFAULT_POSTCODE_GEOGRAPHIES = [
	"localAuthority",
	"ward",
	"constituency",
];

export const POSTCODE_NOTE =
	"A postcode is placed by the single centroid the ONS Postcode Directory gives it. Its addresses can fall on both sides of a boundary, so an area containing the centroid need not contain every address in the postcode.";

const UNDECLARED_ACCURACY =
	"The directory does not state how far this centroid may lie from the postcode's addresses, so positionalToleranceM covers only its grid reference and nearBoundary may understate the risk of a different answer.";

export const UNDECLARED_POSTCODE_ACCURACY = UNDECLARED_ACCURACY;

export type PostcodeOutcome =
	| { status: "found"; record: PostcodeRecord }
	| {
			status: "invalid" | "not-found" | "not-served";
			detail: string;
	  };

/**
 * What the index says of a postcode as a caller typed it. The postcode index
 * must be present; the single lookup refuses with the outcome's problem, and a
 * batch reports it against the one postcode.
 */
export const postcodeOutcome = (
	context: RouteRequest["context"],
	text: string,
): PostcodeOutcome => {
	const parsed = parsePostcode(text);
	if (!parsed)
		return {
			status: "invalid",
			detail: `${JSON.stringify(text)} is not a UK postcode. Give a full unit postcode such as SW1A 1AA; the space is optional.`,
		};
	if (parsed.kind !== "unit")
		return {
			status: "invalid",
			detail: `${parsed.display} is a postcode ${parsed.kind}, which covers many postcodes. Give a full unit postcode such as ${parsed.kind === "district" ? `${parsed.display} 1AA` : `${parsed.display}AA`}.`,
		};
	const index = context.geographyResolver.postcodeIndex()!;
	const found = index.lookup(parsed);
	if (found.status === "excluded")
		return { status: "not-served", detail: found.reason };
	if (found.status === "not-found")
		return {
			status: "not-found",
			detail: `${parsed.display} is not in the ${index.artifact.source.title}. It may never have been issued, or be newer than that edition.`,
		};
	return found;
};

/** The directory's provenance, as every postcode answer carries it. */
export const postcodeSourceSummary = (
	context: RouteRequest["context"],
): PostcodeSourceSummary => {
	const { source } = context.geographyResolver.postcodeIndex()!.artifact;
	return {
		title: source.title,
		edition: source.edition,
		publisher: source.publisher,
		licence: source.licence,
		attribution: source.attribution,
	};
};

/**
 * A unit postcode as a caller typed it, found in the compiled index, or the
 * problem that explains why it cannot be. Every route that accepts a single
 * postcode refuses one the same way.
 */
export const findPostcode = (
	context: RouteRequest["context"],
	text: string,
): { record: PostcodeRecord; source: PostcodeSourceSummary } | ApiResponse => {
	const { geographyResolver } = context;
	const unavailable =
		geographyResolver.requires("postcodes") ??
		geographyResolver.requires("geometry");
	if (unavailable) return unavailable;
	const outcome = postcodeOutcome(context, text);
	if (outcome.status !== "found")
		return outcome.status === "invalid"
			? problem(400, "Invalid Postcode", outcome.detail)
			: outcome.status === "not-served"
				? problem(451, "Postcode Not Served", outcome.detail)
				: problem(404, "Postcode Not Found", outcome.detail);
	return { record: outcome.record, source: postcodeSourceSummary(context) };
};

export type PostcodeSourceSummary = Pick<
	PostcodeSource,
	"title" | "edition" | "publisher" | "licence" | "attribution"
>;

/**
 * The releases a postcode lookup reads: the geographies and date asked for,
 * or else the default geographies as at the directory's edition, the date its
 * centroids are known for.
 */
const postcodeLookupRequest = (
	context: RouteRequest["context"],
	query: URLSearchParams,
	edition: string,
) => {
	const searchParams = new URLSearchParams(query);
	if (
		searchParams.getAll("geography").length === 0 &&
		!searchParams.has("release")
	)
		for (const geography of DEFAULT_POSTCODE_GEOGRAPHIES)
			searchParams.append("geography", geography);
	const dateBasis = searchParams.has("date")
		? ("requested" as const)
		: ("directory-edition" as const);
	if (!searchParams.has("date")) searchParams.set("date", edition);
	const request = parseLookupRequest(context, searchParams);
	return "status" in request ? request : { request, dateBasis };
};

/**
 * How much of an answer a postcode route gives: everything that explains it,
 * or `compact`, only what most callers read (each area, the centroid and the
 * required attribution).
 */
type PostcodeView = "full" | "compact";

const postcodeView = (query: URLSearchParams): PostcodeView | ApiResponse => {
	const view = query.get("view");
	if (view === null || view === "full") return "full";
	if (view === "compact") return "compact";
	return problem(
		400,
		"Invalid Query",
		`view must be full or compact; ${JSON.stringify(view)} is neither.`,
	);
};

/**
 * A point's matches without the release-wide geometry provenance each
 * repeats; the release states it once, and a match keeps only the corrections
 * that moved that area.
 */
const matchesWithoutProvenance = (matches: PointResult["matches"]) =>
	matches.map(({ geometrySource, ...match }) => ({
		...match,
		...(geometrySource.corrections
			? { corrections: geometrySource.corrections }
			: {}),
	}));

/**
 * Whether a result's detail is about the point rather than its release. A
 * batch explains a release that could not be read once, in releases.
 */
const isPointDetail = (status: PointResult["status"]) =>
	status === "no-match" || status === "outside-coverage";

/**
 * A lookup result as the compact view gives it: each area and no more. A
 * batch passes `pointDetailOnly`, as it states release problems once.
 */
const compactResult = (result: PointResult, pointDetailOnly = false) => ({
	geography: result.geography,
	...(result.boundaryRelease !== undefined
		? { boundaryRelease: result.boundaryRelease }
		: {}),
	status: result.status,
	...(result.detail !== undefined &&
	(pointDetailOnly
		? isPointDetail(result.status)
		: result.status !== "matched")
		? { detail: result.detail }
		: {}),
	matches: result.matches.map(({ id, code, name, nearBoundary }) => ({
		id,
		code,
		name,
		nearBoundary,
	})),
});

const compactPoint = ({ lng, lat }: LookupPoint) => ({ lng, lat });

const compactSource = ({
	title,
	edition,
	attribution,
}: PostcodeSourceSummary) => ({ title, edition, attribution });

/** The directory's record, as the compact view gives it. */
const compactRecord = (record: PostcodeRecord) => ({
	postcode: record.postcode,
	status: record.status,
	...(record.terminated ? { terminated: record.terminated } : {}),
	country: record.country,
});

/**
 * A unit postcode, where its centroid lies and the areas containing it: the
 * way most people name where they are, resolved through the same point lookup
 * as any coordinate.
 */
export const handlePostcodeRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 3 ||
		segments[0] !== "v1" ||
		segments[1] !== "postcodes"
	)
		return undefined;
	const view = postcodeView(parsedUrl.searchParams);
	if (typeof view !== "string") return view;
	const found = findPostcode(context, segments[2]!);
	if ("status" in found) return found;
	const { geographyResolver } = context;
	const { record, source: sourceSummary } = found;
	const lookup = postcodeLookupRequest(
		context,
		parsedUrl.searchParams,
		sourceSummary.edition,
	);
	if ("status" in lookup) return lookup;
	const { request, dateBasis } = lookup;
	if (!record.centroid)
		return {
			status: 200,
			body: envelope(releaseId, {
				...(view === "compact"
					? { ...compactRecord(record), point: null }
					: record),
				results: [],
				detail: "The directory gives this postcode no grid reference, so it cannot be placed in any area.",
				source:
					view === "compact"
						? compactSource(sourceSummary)
						: sourceSummary,
			}),
		};
	const point = postcodeLookupPoint(record.centroid);
	const [{ country, results }] = locatePoints(
		geographyResolver,
		request,
		[point],
		[compactPostcode(record.postcode)],
	) as [ReturnType<typeof locatePoints>[number]];
	const caution =
		record.centroid.positionalQuality.accuracyM === null
			? { caution: UNDECLARED_ACCURACY }
			: {};
	if (view === "compact")
		return {
			status: 200,
			body: envelope(releaseId, {
				...compactRecord(record),
				point: compactPoint(point),
				date: request.date!.date,
				results: results.map((result) => compactResult(result)),
				...caution,
				source: compactSource(sourceSummary),
			}),
		};
	return {
		status: 200,
		body: envelope(releaseId, {
			...record,
			point,
			date: request.date!.date,
			dateBasis,
			pointCountry: country,
			boundaryRule: "included",
			results: request.releases.map((lookupRelease, at) => {
				const result = results[at]!;
				return {
					...describeLookupRelease(geographyResolver, lookupRelease),
					...result,
					matches: matchesWithoutProvenance(result.matches),
				};
			}),
			...caution,
			source: sourceSummary,
			note: `${POSTCODE_NOTE} ${CONTAINMENT_NOTE} Geometry provenance is given once per result; a match lists corrections only where one moved that area.`,
		}),
	};
};

/** The place reference a postcode candidate carries, `postcode/SW1A1AA`. */
export const POSTCODE_REFERENCE = "postcode/";

/** The postcode a place query or reference names, when it names one. */
export const postcodeInPlace = (query: string) => {
	const text = query.startsWith(POSTCODE_REFERENCE)
		? query.slice(POSTCODE_REFERENCE.length)
		: query;
	return parsePostcode(text);
};

/**
 * What a place search makes of a query written as a postcode: a candidate for
 * a unit postcode the index holds, or a hint saying why there is none. Nothing
 * here reads geometry, so a place search stays as fast as a name lookup; the
 * candidate links to the routes that place the postcode in areas.
 */
export const postcodePlace = (
	context: RouteRequest["context"],
	query: string,
): { candidate?: Record<string, unknown>; hint?: string } => {
	const parsed = postcodeInPlace(query);
	if (!parsed) return {};
	if (parsed.kind !== "unit")
		return {
			hint: `${parsed.display} reads as a postcode ${parsed.kind}, which covers many postcodes. A full unit postcode, such as ${parsed.kind === "district" ? `${parsed.display} 1AA` : `${parsed.display}AA`}, is found as a place.`,
		};
	const index = context.geographyResolver.postcodeIndex();
	if (!index) return {};
	const found = index.lookup(parsed);
	if (found.status === "excluded") return { hint: found.reason };
	if (found.status === "not-found")
		return {
			hint: `${parsed.display} reads as a postcode but is not in the ${index.artifact.source.title}.`,
		};
	const { record } = found;
	const point = record.centroid && postcodeLookupPoint(record.centroid);
	return {
		candidate: {
			place: `${POSTCODE_REFERENCE}${parsed.compact}`,
			kind: "postcode",
			name: record.postcode,
			geography: "postcode",
			code: record.postcode,
			match: "exact",
			status: record.status,
			...(record.terminated ? { terminated: record.terminated } : {}),
			country: record.country,
			point: point ? { lng: point.lng, lat: point.lat } : null,
			href: `/v1/postcodes/${parsed.compact}`,
			edition: index.artifact.source.edition,
		},
	};
};

/** Postcodes a batch lookup accepts; more belongs in a bulk export. */
export const MAX_BATCH_POSTCODES = 100;

/**
 * The same lookup for a bounded batch of postcodes. A postcode that cannot be
 * placed is reported in its own entry rather than failing the batch, and the
 * placed centroids are looked up together, so each release's geometry is read
 * once for the whole batch.
 */
export const handlePostcodeBatchRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
	method,
	body,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "postcodes:batch"
	)
		return undefined;
	if (method !== "POST")
		return problem(
			405,
			"Method Not Allowed",
			"POST a JSON body with a postcodes array to this batch lookup.",
		);
	const view = postcodeView(parsedUrl.searchParams);
	if (typeof view !== "string") return view;
	const posted = readBatchInput(body, "postcodes");
	if (!Array.isArray(posted)) return posted;
	const inputs = posted.map((value) => value.trim()).filter(Boolean);
	if (inputs.length === 0)
		return problem(
			400,
			"Invalid Query",
			"Supply at least one postcode in the postcodes array.",
		);
	if (inputs.length > MAX_BATCH_POSTCODES)
		return problem(
			400,
			"Invalid Query",
			`At most ${MAX_BATCH_POSTCODES} postcodes can be looked up in one request; this one has ${inputs.length}.`,
		);
	const { geographyResolver } = context;
	const unavailable =
		geographyResolver.requires("postcodes") ??
		geographyResolver.requires("geometry");
	if (unavailable) return unavailable;
	const source = postcodeSourceSummary(context);
	const lookup = postcodeLookupRequest(
		context,
		parsedUrl.searchParams,
		source.edition,
	);
	if ("status" in lookup) return lookup;
	const { request, dateBasis } = lookup;
	const outcomes = inputs.map((input) => postcodeOutcome(context, input));
	const placed = outcomes.flatMap((outcome, index) =>
		outcome.status === "found" && outcome.record.centroid
			? [{ index, point: postcodeLookupPoint(outcome.record.centroid) }]
			: [],
	);
	const located = locatePoints(
		geographyResolver,
		request,
		placed.map(({ point }) => point),
		placed.map(({ index }) =>
			compactPostcode(
				(outcomes[index] as { record: PostcodeRecord }).record.postcode,
			),
		),
	);
	const locatedAt = new Map(
		placed.map(({ index, point }, at) => [
			index,
			{ point, ...located[at]! },
		]),
	);
	const statuses = located.flatMap(({ results }) =>
		results.map((result) => result.status),
	);
	const count = (status: string) =>
		outcomes.filter((outcome) => outcome.status === status).length;
	const entries = outcomes.map((outcome, index) => {
		if (outcome.status !== "found")
			return {
				index,
				input: inputs[index]!,
				status: outcome.status,
				detail: outcome.detail,
			};
		const { record } = outcome;
		const at = locatedAt.get(index);
		const postcode = view === "compact" ? compactRecord(record) : record;
		if (!at || !record.centroid)
			return {
				index,
				input: inputs[index]!,
				status: "not-placed" as const,
				postcode,
				detail: "The directory gives this postcode no grid reference, so it cannot be placed in any area.",
			};
		const caution =
			record.centroid.positionalQuality.accuracyM === null
				? { caution: UNDECLARED_ACCURACY }
				: {};
		if (view === "compact")
			return {
				index,
				input: inputs[index]!,
				status: "placed" as const,
				postcode,
				point: compactPoint(at.point),
				results: at.results.map((result) =>
					compactResult(result, true),
				),
				...caution,
			};
		return {
			index,
			input: inputs[index]!,
			status: "placed" as const,
			postcode,
			point: at.point,
			pointCountry: at.country,
			results: at.results.map(({ matches, detail, ...result }) => ({
				...result,
				// A release that could not be read explains itself once, in
				// releases; only an answer about this point is repeated here.
				...(detail !== undefined && isPointDetail(result.status)
					? { detail }
					: {}),
				matches: matchesWithoutProvenance(matches),
			})),
			...caution,
		};
	});
	const releases = request.releases.map((lookupRelease) =>
		describeLookupRelease(geographyResolver, lookupRelease),
	);
	const summary = {
		postcodes: inputs.length,
		placed: placed.length,
		notPlaced: outcomes.filter(
			(outcome) => outcome.status === "found" && !outcome.record.centroid,
		).length,
		invalid: count("invalid"),
		notFound: count("not-found"),
		notServed: count("not-served"),
		lookups: statuses.length,
		matched: statuses.filter((status) => status === "matched").length,
		noMatch: statuses.filter((status) => status === "no-match").length,
		outsideCoverage: statuses.filter(
			(status) => status === "outside-coverage",
		).length,
		unresolved: statuses.filter(
			(status) =>
				status !== "matched" &&
				status !== "no-match" &&
				status !== "outside-coverage",
		).length,
		nearBoundary: located.reduce(
			(total, { results }) =>
				total +
				results.filter((result) =>
					result.matches.some((match) => match.nearBoundary),
				).length,
			0,
		),
	};
	if (view === "compact")
		return {
			status: 200,
			body: envelope(releaseId, {
				date: request.date!.date,
				releases: releases.map((release) => ({
					geography: release.geography,
					...("boundaryRelease" in release
						? { boundaryRelease: release.boundaryRelease }
						: {}),
					...(release.status !== undefined
						? { status: release.status, detail: release.detail }
						: {}),
				})),
				summary,
				postcodes: entries,
				source: compactSource(source),
			}),
		};
	return {
		status: 200,
		body: envelope(releaseId, {
			date: request.date!.date,
			dateBasis,
			boundaryRule: "included",
			releases,
			summary,
			postcodes: entries,
			source,
			note: `${POSTCODE_NOTE} ${CONTAINMENT_NOTE} Release-wide geometry provenance is given once in releases; a match lists corrections only where one moved that area.`,
		}),
	};
};
