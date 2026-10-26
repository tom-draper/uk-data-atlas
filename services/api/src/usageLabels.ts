import type { BoundaryRegistry } from "./boundaryRegistry";
import type { DataCatalog } from "./dataCatalog";

/**
 * What a request is asking about, reduced to ids from our own catalogue.
 *
 * Usage counts exist to show which datasets and archives people want, so the
 * only things kept are the route template, the outcome, and a measure,
 * geography and release id. Each id is checked against the catalogue and any
 * value that is not in it becomes `unknown`: a typed place name, a postcode or
 * a guessed id never reaches a label, and the number of distinct labels is
 * bounded by the catalogue rather than by traffic.
 */
export const UNKNOWN = "unknown";

export type UsageVocabulary = {
	measures: ReadonlySet<string>;
	geographies: ReadonlySet<string>;
	/** Release ids published for each geography. */
	releases: ReadonlyMap<string, ReadonlySet<string>>;
};

export const usageVocabulary = (
	dataCatalog: Pick<DataCatalog, "measures"> | undefined,
	boundaryRegistry: Pick<BoundaryRegistry, "releases">,
): UsageVocabulary => {
	const releases = new Map<string, Set<string>>();
	for (const release of boundaryRegistry.releases) {
		const ids = releases.get(release.geography) ?? new Set<string>();
		ids.add(release.id);
		releases.set(release.geography, ids);
	}
	return {
		measures: new Set(dataCatalog?.measures.map(({ id }) => id)),
		geographies: new Set(releases.keys()),
		releases,
	};
};

export type UsageOutcome = "2xx" | "3xx" | "4xx" | "5xx";

/** Why a request found nothing, where it did not. */
export type NotFoundKind =
	| "unknown-measure"
	| "unknown-geography"
	| "unknown-release"
	| "unknown-area"
	| "unresolved-place"
	| "unresolved-postcode"
	| "unmatched-route"
	| "not-found";

/**
 * One request's usage. Every field is a template, an enumeration or a
 * catalogue id; an empty string means the dimension does not apply.
 */
export type UsageEvent = {
	route: string;
	outcome: UsageOutcome;
	/** A problem's `code`, else its type slug; empty on success. */
	problem: string;
	measure: string;
	geography: string;
	release: string;
	notFound: NotFoundKind | "";
};

export type UsageRequest = {
	/** The OpenAPI template the request matched, with its `/v1` prefix. */
	route: string;
	/** The matched operation's path key, such as `/data/{measure-id}`. */
	template?: string;
	pathname: string;
	searchParams?: URLSearchParams;
	status: number;
	/** The problem body's `type` and `code`, when the answer was a problem. */
	problem?: { type?: unknown; code?: unknown };
};

const SLUG = /^[a-z0-9][a-z0-9_-]{0,47}$/;

const outcomeOf = (status: number): UsageOutcome =>
	status >= 500
		? "5xx"
		: status >= 400
			? "4xx"
			: status >= 300
				? "3xx"
				: "2xx";

/**
 * A problem's stable name. A `code` is declared in the contract; otherwise the
 * type's last segment, a slug of a title written in source. Anything that is
 * not slug-shaped is reported as `other` rather than stored.
 */
const problemName = (problem: UsageRequest["problem"]) => {
	const raw =
		typeof problem?.code === "string"
			? problem.code
			: typeof problem?.type === "string"
				? problem.type.split("/").pop()!
				: "";
	return raw === "" || SLUG.test(raw) ? raw : "other";
};

/** The value of a `{parameter}` segment of the template, from the path. */
const pathParameters = (template: string | undefined, pathname: string) => {
	const values = new Map<string, string>();
	if (!template) return values;
	const names = template.split("/").filter(Boolean);
	const parts = pathname.split("/").filter(Boolean).slice(1);
	names.forEach((name, index) => {
		const part = parts[index];
		const parameter = /^\{([^}]+)\}$/.exec(name);
		if (parameter && part !== undefined) {
			try {
				values.set(parameter[1]!, decodeURIComponent(part));
			} catch {
				values.set(parameter[1]!, "");
			}
		}
	});
	return values;
};

const UNRESOLVED_PROBLEMS: Record<string, NotFoundKind> = {
	"postcode-not-found": "unresolved-postcode",
	"unknown-place": "unresolved-place",
};

/**
 * A release id is known for the geography that publishes it. With no
 * geography to pin it to, any publication of it will do; beside an unknown
 * geography it means nothing.
 */
const knownRelease = (
	vocabulary: UsageVocabulary,
	geography: string,
	release: string,
) =>
	geography === ""
		? [...vocabulary.releases.values()].some((ids) => ids.has(release))
		: vocabulary.releases.get(geography)?.has(release) === true;

export const classifyUsage = (
	vocabulary: UsageVocabulary,
	request: UsageRequest,
): UsageEvent => {
	const parameters = pathParameters(request.template, request.pathname);
	const query = request.searchParams;
	const rawMeasure = parameters.get("measure-id") ?? "";
	// Only the path names a measure; `geography` and `release` may also be
	// query parameters on routes that take a partition.
	const rawGeography =
		parameters.get("geography") ?? query?.get("geography") ?? "";
	const rawRelease = parameters.get("release") ?? query?.get("release") ?? "";

	const measure = rawMeasure
		? vocabulary.measures.has(rawMeasure)
			? rawMeasure
			: UNKNOWN
		: "";
	const geography = rawGeography
		? vocabulary.geographies.has(rawGeography)
			? rawGeography
			: UNKNOWN
		: "";
	const release = rawRelease
		? knownRelease(vocabulary, geography, rawRelease)
			? rawRelease
			: UNKNOWN
		: "";

	const problem = problemName(request.problem);
	const outcome = outcomeOf(request.status);

	let notFound: UsageEvent["notFound"] = "";
	const missing =
		request.status === 404 ||
		(request.status === 422 &&
			(problem === "not-found" || problem in UNRESOLVED_PROBLEMS));
	if (missing) {
		if (measure === UNKNOWN) notFound = "unknown-measure";
		else if (geography === UNKNOWN || problem === "unsupported_geography")
			notFound = "unknown-geography";
		else if (problem === "unknown_release" || release === UNKNOWN)
			notFound = "unknown-release";
		else if (request.route === "unmatched") notFound = "unmatched-route";
		else if (problem in UNRESOLVED_PROBLEMS)
			notFound = UNRESOLVED_PROBLEMS[problem]!;
		else if (parameters.has("code")) notFound = "unknown-area";
		else notFound = "not-found";
	}

	return {
		route: request.route,
		outcome,
		problem,
		measure,
		geography,
		release,
		notFound,
	};
};
