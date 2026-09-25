import {
	CONTAINMENT_NOTE,
	describeLookupRelease,
	locatePoints,
	parseLookupRequest,
} from "./pointLookup";
import {
	parsePostcode,
	postcodeLookupPoint,
	type PostcodeRecord,
	type PostcodeSource,
} from "./postcodes";
import { envelope, problem, type ApiResponse } from "./routeResponse";
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

/**
 * A unit postcode as a caller typed it, found in the compiled index, or the
 * problem that explains why it cannot be. Every route that accepts a postcode
 * refuses one the same way.
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
	const parsed = parsePostcode(text);
	if (!parsed)
		return problem(
			400,
			"Invalid Postcode",
			`${JSON.stringify(text)} is not a UK postcode. Give a full unit postcode such as SW1A 1AA; the space is optional.`,
		);
	if (parsed.kind !== "unit")
		return problem(
			400,
			"Invalid Postcode",
			`${parsed.display} is a postcode ${parsed.kind}, which covers many postcodes. Give a full unit postcode such as ${parsed.kind === "district" ? `${parsed.display} 1AA` : `${parsed.display}AA`}.`,
		);
	const index = geographyResolver.postcodeIndex()!;
	const { source } = index.artifact;
	const found = index.lookup(parsed);
	if (found.status === "excluded")
		return problem(451, "Postcode Not Served", found.reason);
	if (found.status === "not-found")
		return problem(
			404,
			"Postcode Not Found",
			`${parsed.display} is not in the ${source.title}. It may never have been issued, or be newer than that edition.`,
		);
	return {
		record: found.record,
		source: {
			title: source.title,
			edition: source.edition,
			publisher: source.publisher,
			licence: source.licence,
			attribution: source.attribution,
		},
	};
};

export type PostcodeSourceSummary = Pick<
	PostcodeSource,
	"title" | "edition" | "publisher" | "licence" | "attribution"
>;

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
	const found = findPostcode(context, segments[2]!);
	if ("status" in found) return found;
	const { geographyResolver } = context;
	const { record, source: sourceSummary } = found;
	const searchParams = new URLSearchParams(parsedUrl.searchParams);
	if (
		searchParams.getAll("geography").length === 0 &&
		!searchParams.has("release")
	)
		for (const geography of DEFAULT_POSTCODE_GEOGRAPHIES)
			searchParams.append("geography", geography);
	// A postcode's areas are read as at the directory's edition unless the
	// caller asks for another date: it is the date its centroid is known for.
	const dateBasis = searchParams.has("date")
		? "requested"
		: "directory-edition";
	if (!searchParams.has("date"))
		searchParams.set("date", sourceSummary.edition);
	const request = parseLookupRequest(context, searchParams);
	if ("status" in request) return request;
	if (!record.centroid)
		return {
			status: 200,
			body: envelope(releaseId, {
				...record,
				results: [],
				detail: "The directory gives this postcode no grid reference, so it cannot be placed in any area.",
				source: sourceSummary,
			}),
		};
	const point = postcodeLookupPoint(record.centroid);
	const [{ country, results }] = locatePoints(
		context,
		geographyResolver,
		request,
		[point],
	) as [ReturnType<typeof locatePoints>[number]];
	return {
		status: 200,
		body: envelope(releaseId, {
			...record,
			point,
			date: request.date!.date,
			dateBasis,
			pointCountry: country,
			boundaryRule: "included",
			results: request.releases.map((lookupRelease, at) => ({
				...describeLookupRelease(geographyResolver, lookupRelease),
				...results[at]!,
			})),
			...(record.centroid.positionalQuality.accuracyM === null
				? { caution: UNDECLARED_ACCURACY }
				: {}),
			source: sourceSummary,
			note: `${POSTCODE_NOTE} ${CONTAINMENT_NOTE}`,
		}),
	};
};
