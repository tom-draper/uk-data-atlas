import { createHash } from "node:crypto";

/**
 * The OpenAPI path templates, used to name the operation a request reached.
 *
 * Metrics and logs label a request by its template, `/v1/areas/{geography}/…`,
 * never by its concrete path: a label per area code would grow without bound.
 * The templates come from the document the server serves, so a route added to
 * the contract is labelled without a second list to keep in step.
 */
export type OperationTemplate = {
	/** The OpenAPI path key, such as `/areas/{geography}/{release}/{code}`. */
	path: string;
	/**
	 * Set when the operation is deprecated. Both dates are required by the
	 * API surface test, so a deprecation always says when it began and when
	 * the operation may be removed.
	 */
	deprecation?: { since?: string; sunset?: string };
	/**
	 * What a request costs from its client's rate-limit bucket, from
	 * `x-rate-limit-cost`, when it is more than one: an operation that reads
	 * many areas' shapes or takes a batch is priced by the work it does.
	 */
	cost?: number;
	/** Query parameters declared for each HTTP operation on this path. */
	queryParameters: Partial<Record<"get" | "post", string[]>>;
	/**
	 * Parameters an operation names in `x-refused-query-parameters`: ones a
	 * caller may reasonably expect it to take, such as `release` on a series,
	 * which its handler refuses with the reason rather than leaving to the
	 * generic unknown-parameter refusal.
	 */
	refusedQueryParameters?: Partial<Record<"get" | "post", string[]>>;
};

export type MatchedOperation = {
	/** The template with its `/v1` prefix, or `unmatched`. */
	route: string;
	operation?: OperationTemplate;
};

const UNMATCHED = "unmatched";

/**
 * The operations the server matches requests against, compiled from
 * `openapi.yaml` at build time so the server reads JSON rather than YAML.
 * It records the hash of the document it was compiled from, so a server
 * started after the document changed refuses to run with the old list.
 */
export type OperationsArtifact = {
	schemaVersion: 1;
	inputs: { openapiDocument: string };
	operations: OperationTemplate[];
};

export const openapiDocumentHash = (openapiDocument: string) =>
	`sha256:${createHash("sha256").update(openapiDocument).digest("hex")}`;

type OpenApiParameter = { $ref?: string; name?: string; in?: string };
type OpenApiOperation = {
	parameters?: OpenApiParameter[];
	deprecated?: boolean;
	"x-deprecated-since"?: unknown;
	"x-sunset"?: unknown;
	"x-rate-limit-cost"?: unknown;
	"x-refused-query-parameters"?: unknown;
};
/** The parts of a parsed OpenAPI document that name operations. */
export type OpenApiOperations = {
	paths?: Record<
		string,
		Partial<Record<"get" | "post", OpenApiOperation>> & {
			parameters?: OpenApiParameter[];
		}
	>;
	components?: { parameters?: Record<string, OpenApiParameter> };
};

/**
 * Each path's templates from a parsed document: its query parameters, with
 * path-level and referenced ones resolved, and each operation's `deprecated`,
 * `x-deprecated-since`, `x-sunset`, `x-rate-limit-cost` and
 * `x-refused-query-parameters`.
 */
export const compileOperationTemplates = (
	document: OpenApiOperations,
): OperationTemplate[] => {
	const resolved = (parameter: OpenApiParameter) => {
		if (!parameter.$ref) return parameter;
		const reference = /^#\/components\/parameters\/(.+)$/.exec(
			parameter.$ref,
		)?.[1];
		const target = reference
			? document.components?.parameters?.[reference]
			: undefined;
		if (!target) throw new Error(`Unresolved reference ${parameter.$ref}`);
		return target;
	};
	const queryNames = (parameters: OpenApiParameter[] | undefined) =>
		(parameters ?? [])
			.map(resolved)
			.filter((parameter) => parameter.in === "query")
			.map((parameter) => String(parameter.name));
	return Object.entries(document.paths ?? {}).map(([path, item]) => {
		const template: OperationTemplate = { path, queryParameters: {} };
		const shared = queryNames(item.parameters);
		for (const method of ["get", "post"] as const) {
			const operation = item[method];
			if (!operation) continue;
			// An operation's own parameter overrides a path-level one by name.
			template.queryParameters[method] = [
				...new Set([...shared, ...queryNames(operation.parameters)]),
			];
			if (operation.deprecated === true)
				template.deprecation = { ...template.deprecation };
			const since = operation["x-deprecated-since"];
			if (since !== undefined)
				template.deprecation = {
					...template.deprecation,
					since: String(since),
				};
			const sunset = operation["x-sunset"];
			if (sunset !== undefined)
				template.deprecation = {
					...template.deprecation,
					sunset: String(sunset),
				};
			const refused = operation["x-refused-query-parameters"];
			if (Array.isArray(refused))
				template.refusedQueryParameters = {
					...template.refusedQueryParameters,
					[method]: refused.map(String),
				};
			// A path with two operations costs what its dearer one does.
			const cost = operation["x-rate-limit-cost"];
			if (typeof cost === "number")
				template.cost = Math.max(template.cost ?? 1, cost);
		}
		return template;
	});
};

type CompiledTemplate = {
	operation: OperationTemplate;
	segments: RegExp[];
	/** Literal segments outrank mixed ones, which outrank placeholders. */
	rank: number[];
};

const compileSegment = (segment: string) =>
	new RegExp(
		`^${segment
			.split(/(\{[^}]+\})/)
			.map((part) =>
				/^\{[^}]+\}$/.test(part)
					? "[^/]+"
					: part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"),
			)
			.join("")}$`,
	);

const segmentRank = (segment: string) =>
	!segment.includes("{") ? 2 : /^\{[^}]+\}$/.test(segment) ? 0 : 1;

const outranks = (left: number[], right: number[]) => {
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return left[index]! > right[index]!;
	}
	return false;
};

/**
 * A function from a request path to the operation it reached. Where two
 * templates match, the one with a literal segment earliest wins, so
 * an operation with a concrete leading segment outranks one with a parameter.
 */
export const createOperationMatcher = (templates: OperationTemplate[]) => {
	const byLength = new Map<number, CompiledTemplate[]>();
	for (const operation of templates) {
		const parts = operation.path.split("/").filter(Boolean);
		const compiled = {
			operation,
			segments: parts.map(compileSegment),
			rank: parts.map(segmentRank),
		};
		byLength.set(parts.length, [
			...(byLength.get(parts.length) ?? []),
			compiled,
		]);
	}
	const find = (segments: string[]) => {
		let best: CompiledTemplate | undefined;
		for (const candidate of byLength.get(segments.length) ?? []) {
			if (
				candidate.segments.every((pattern, index) =>
					pattern.test(segments[index]!),
				) &&
				(!best || outranks(candidate.rank, best.rank))
			)
				best = candidate;
		}
		return best?.operation;
	};
	return (pathname: string): MatchedOperation => {
		const segments = pathname.split("/").filter(Boolean);
		if (segments[0] !== "v1") return { route: UNMATCHED };
		const rest = segments.slice(1);
		const operation = find(rest);
		return operation
			? {
					route:
						operation.path === "/" ? "/v1" : `/v1${operation.path}`,
					operation,
				}
			: { route: UNMATCHED };
	};
};

export type OperationMatcher = ReturnType<typeof createOperationMatcher>;

const editDistance = (left: string, right: string) => {
	const previous = Array.from(
		{ length: right.length + 1 },
		(_, index) => index,
	);
	for (let row = 1; row <= left.length; row += 1) {
		let diagonal = previous[0]!;
		previous[0] = row;
		for (let column = 1; column <= right.length; column += 1) {
			const above = previous[column]!;
			previous[column] = Math.min(
				previous[column]! + 1,
				previous[column - 1]! + 1,
				diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
			);
			diagonal = above;
		}
	}
	return previous[right.length]!;
};

/** The first undeclared query parameter, with a useful spelling correction where possible. */
export const unexpectedQueryParameter = (
	operation: OperationTemplate | undefined,
	method: string,
	target: string,
) => {
	const key =
		method === "HEAD" ? "get" : (method.toLowerCase() as "get" | "post");
	const declared = operation?.queryParameters[key];
	if (!declared) return undefined;
	const refused = operation?.refusedQueryParameters?.[key] ?? [];
	const supplied = [
		...new URL(target, "http://localhost").searchParams.keys(),
	];
	const parameter = supplied.find(
		(name) => !declared.includes(name) && !refused.includes(name),
	);
	if (!parameter) return undefined;
	const nearest = declared
		.map((candidate) => ({
			candidate,
			distance: editDistance(
				parameter.toLowerCase(),
				candidate.toLowerCase(),
			),
		}))
		.sort(
			(left, right) =>
				left.distance - right.distance ||
				left.candidate.localeCompare(right.candidate),
		)[0];
	const suggestion =
		nearest &&
		nearest.distance <= Math.max(2, Math.floor(parameter.length / 3))
			? nearest.candidate
			: undefined;
	return { parameter, ...(suggestion ? { suggestion } : {}) };
};

/**
 * RFC 9745 `Deprecation` and RFC 8594 `Sunset` for a deprecated operation, so
 * a client learns of it from the responses it already receives.
 */
export const deprecationHeaders = (
	operation: OperationTemplate | undefined,
): Record<string, string> => {
	const deprecation = operation?.deprecation;
	if (!deprecation) return {};
	const since = deprecation.since ? Date.parse(deprecation.since) : NaN;
	const sunset = deprecation.sunset ? Date.parse(deprecation.sunset) : NaN;
	return {
		deprecation: Number.isNaN(since)
			? "true"
			: `@${Math.floor(since / 1000)}`,
		...(Number.isNaN(sunset)
			? {}
			: { sunset: new Date(sunset).toUTCString() }),
	};
};
