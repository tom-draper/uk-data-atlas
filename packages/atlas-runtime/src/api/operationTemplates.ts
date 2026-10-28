import type { OperationTemplate } from "./operations";
export { openapiDocumentHash } from "./operations";
export type { OperationTemplate, OperationsArtifact } from "./operations";

export type MatchedOperation = {
	/** The template with its `/v1` prefix, or `unmatched`. */
	route: string;
	operation?: OperationTemplate;
};

const UNMATCHED = "unmatched";

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
 * RFC 9745 `Deprecation` and RFC 8594 `Sunset` fields for something retired
 * on a given date, so a client learns of it from the responses it already
 * receives. A date that does not parse is announced as a bare `true`.
 */
export const deprecationFields = (
	since: string | undefined,
	sunset: string | undefined,
): Record<string, string> => {
	const sinceTime = since ? Date.parse(since) : NaN;
	const sunsetTime = sunset ? Date.parse(sunset) : NaN;
	return {
		deprecation: Number.isNaN(sinceTime)
			? "true"
			: `@${Math.floor(sinceTime / 1000)}`,
		...(Number.isNaN(sunsetTime)
			? {}
			: { sunset: new Date(sunsetTime).toUTCString() }),
	};
};

/** The fields for a deprecated operation. */
export const deprecationHeaders = (
	operation: OperationTemplate | undefined,
): Record<string, string> => {
	const deprecation = operation?.deprecation;
	return deprecation
		? deprecationFields(deprecation.since, deprecation.sunset)
		: {};
};
