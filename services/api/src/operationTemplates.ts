import { parse } from "yaml";

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

type OpenApiParameter = {
	$ref?: string;
	in?: string;
	name?: string;
};

type OpenApiOperation = {
	deprecated?: boolean;
	parameters?: OpenApiParameter[];
	"x-deprecated-since"?: string;
	"x-rate-limit-cost"?: number;
	"x-refused-query-parameters"?: string[];
	"x-sunset"?: string;
};

type OpenApiDocument = {
	components?: { parameters?: Record<string, OpenApiParameter> };
	paths?: Record<string, Partial<Record<"get" | "post", OpenApiOperation>>>;
};

const queryParameters = (
	parameters: OpenApiParameter[] | undefined,
	components: Record<string, OpenApiParameter> | undefined,
) =>
	(parameters ?? []).flatMap((parameter) => {
		const reference = parameter.$ref?.split("/").at(-1);
		const resolved = reference ? components?.[reference] : parameter;
		return resolved?.in === "query" && resolved.name ? [resolved.name] : [];
	});

export const readOperationTemplates = (
	openapiDocument: string,
): OperationTemplate[] => {
	const document = parse(openapiDocument) as OpenApiDocument;
	return Object.entries(document.paths ?? {}).map(([path, item]) => {
		const template: OperationTemplate = { path, queryParameters: {} };
		for (const method of ["get", "post"] as const) {
			const operation = item[method];
			if (!operation) continue;
			template.queryParameters[method] = queryParameters(
				operation.parameters,
				document.components?.parameters,
			);
			if (operation.deprecated)
				template.deprecation = {
					...template.deprecation,
					...(operation["x-deprecated-since"]
						? { since: String(operation["x-deprecated-since"]) }
						: {}),
					...(operation["x-sunset"]
						? { sunset: String(operation["x-sunset"]) }
						: {}),
				};
			if (operation["x-refused-query-parameters"])
				template.refusedQueryParameters = {
					...template.refusedQueryParameters,
					[method]: operation["x-refused-query-parameters"],
				};
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
