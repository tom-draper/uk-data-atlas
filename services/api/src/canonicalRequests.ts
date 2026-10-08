import { problem, type ApiResponse } from "./routeResponse";
import { releaseMonth } from "./releaseForDate";
import type { RouteRequest } from "./routing";
import { canonicalMeasureId } from "./measureTerms";
import { canonicalGeography } from "./geography";

// Where a path carries a measure id: /v1/data/{id}, /v1/measures/{id} and a
// map resource's /join/{id}.
const measureSegment = (segments: string[]) =>
	segments[0] !== "v1"
		? undefined
		: segments[1] === "data" || segments[1] === "measures"
			? 2
			: segments[1] === "map-resources" && segments[4] === "join"
				? 5
				: undefined;

/**
 * The request with every measure alias replaced by the id it names, or
 * undefined when it names none. A route then only ever sees ids, and the
 * response says what the alias was read as.
 */
export const canonicalMeasureRequest = (
	request: RouteRequest,
): RouteRequest | undefined => {
	const catalog = request.context.dataCatalog;
	if (!catalog) return undefined;
	const canonical = (term: string) =>
		canonicalMeasureId(catalog, term) ?? term;
	const segments = [...request.segments];
	const position = measureSegment(segments);
	if (position !== undefined && segments[position] !== undefined)
		segments[position] = canonical(segments[position]!);
	const url = new URL(request.parsedUrl);
	const measures = url.searchParams.getAll("measure");
	if (measures.length > 0) {
		url.searchParams.delete("measure");
		for (const measure of measures)
			url.searchParams.append("measure", canonical(measure));
	}
	url.pathname = `/${segments.map(encodeURIComponent).join("/")}`;
	const changed =
		segments.some(
			(segment, index) => segment !== request.segments[index],
		) || measures.some((measure) => canonical(measure) !== measure);
	return changed ? { ...request, parsedUrl: url, segments } : undefined;
};

/** The word that stands for a geography's newest release in a path. */
export const LATEST_RELEASE = "latest";

/** The resources whose third segment names a geography. */
const geographyResources = ["areas", "boundary-releases", "map-resources"];

const isGeographyPath = (segments: string[]) =>
	segments[0] === "v1" && geographyResources.includes(segments[1] ?? "");

/**
 * The request routed to other segments. A colon is legal in a path segment,
 * and `:join` reads better as one, so it is left unescaped.
 */
const withSegments = (
	request: RouteRequest,
	segments: string[],
): RouteRequest => {
	const parsedUrl = new URL(request.parsedUrl);
	parsedUrl.pathname = `/${segments
		.map((segment) => encodeURIComponent(segment).replaceAll("%3A", ":"))
		.join("/")}`;
	return { ...request, parsedUrl, segments };
};

/** Replace a path geography abbreviation before any route resolves releases. */
export const canonicalGeographyRequest = (
	request: RouteRequest,
): RouteRequest | undefined => {
	const { segments } = request;
	if (!isGeographyPath(segments)) return undefined;
	const geography = segments[2];
	const canonical = geography && canonicalGeography(geography);
	if (!canonical || canonical === geography) return undefined;
	const canonicalSegments = [...segments];
	canonicalSegments[2] = canonical;
	return withSegments(request, canonicalSegments);
};

/**
 * Where a path names a boundary release as `latest`, and what the segment
 * carries after it: `:join` on a release, `.pmtiles` on a map resource.
 */
const latestReleaseSegment = (segments: string[]) => {
	if (!isGeographyPath(segments) || segments[2] === undefined)
		return undefined;
	const suffix = new RegExp(`^${LATEST_RELEASE}(:join|\\.pmtiles)?$`).exec(
		segments[3] ?? "",
	);
	return suffix
		? { geography: segments[2], suffix: suffix[1] ?? "" }
		: undefined;
};

/**
 * The request with `latest` replaced by the geography's newest release, the
 * one `/boundary-releases:resolve` would choose for the furthest date, or
 * the problem that says why there is no one newest release. A route only
 * ever sees a release id, and the response names the release it read.
 */
export const canonicalReleaseRequest = (
	request: RouteRequest,
): RouteRequest | ApiResponse | undefined => {
	const latest = latestReleaseSegment(request.segments);
	if (!latest) return undefined;
	const releases = request.context.boundaryRegistry.releases.filter(
		(release) => release.geography === latest.geography,
	);
	const selection =
		releases.length === 1
			? undefined
			: request.context.geographyResolver.selectReleaseForDate(
					latest.geography,
					"9999-12",
				);
	if (releases.length === 0)
		return problem(
			404,
			"Not Found",
			`No boundary release is published for the geography ${latest.geography}.`,
			{
				code: "unsupported_geography",
				links: { geographies: "/v1/geographies" },
			},
		);
	// A release id without a month cannot be placed in time, so while one
	// stands beside others which of them is newest is not something to guess.
	const undated = releases.filter(
		(release) => releaseMonth(release.id) === undefined,
	);
	if (
		releases.length > 1 &&
		(undated.length > 0 || selection?.status !== "selected")
	)
		return problem(
			409,
			"Ambiguous Release",
			undated.length > 0
				? `${undated.map((release) => release.id).join(" and ")} ${undated.length === 1 ? "carries" : "carry"} no month, so which ${latest.geography} release is newest cannot be told. Name one by id; each is listed in choices.`
				: `Several ${latest.geography} boundary releases share the latest month and differ in more than coverage. Name one by id; each is listed in choices.`,
			{
				code: "ambiguous_release",
				// The newest dated release, or those tied for it, and every
				// undated one, since any of them may be the newest.
				choices: [
					...(selection?.status === "selected"
						? [selection.selected]
						: selection?.status === "ambiguous"
							? selection.choices
							: []),
					...undated.map((release) => ({
						id: release.id,
						title: release.title,
						countries: release.coverage.countries,
						href: `/v1/boundary-releases/${latest.geography}/${release.id}`,
					})),
				],
			},
		);
	const newest =
		selection?.status === "selected"
			? selection.selected.id
			: releases[0]!.id;
	const segments = [...request.segments];
	segments[3] = `${newest}${latest.suffix}`;
	return withSegments(request, segments);
};
