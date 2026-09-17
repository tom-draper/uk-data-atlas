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
};

export type MatchedOperation = {
	/** The template with its `/v1` prefix, or `unmatched`. */
	route: string;
	operation?: OperationTemplate;
	/** The Atlas release the path was pinned to, when it was. */
	pinnedTo?: string;
};

const UNMATCHED = "unmatched";
const PINNED_PREFIX = "/atlas-releases/{release-id}";

/**
 * Reads path keys, and each operation's `deprecated`, `x-deprecated-since` and
 * `x-sunset`, by line: path keys sit at a two-space indent under `paths:` and
 * operation fields at six. The server does not load a YAML parser at runtime.
 */
export const readOperationTemplates = (
	openapiDocument: string,
): OperationTemplate[] => {
	const templates: OperationTemplate[] = [];
	let inPaths = false;
	let current: OperationTemplate | undefined;
	for (const line of openapiDocument.split("\n")) {
		if (/^\S/.test(line)) {
			inPaths = line.startsWith("paths:");
			current = undefined;
			continue;
		}
		if (!inPaths) continue;
		const path = /^ {2}(\/\S*):\s*$/.exec(line)?.[1];
		if (path) {
			current = { path };
			templates.push(current);
			continue;
		}
		if (!current) continue;
		if (/^ {6}deprecated:\s*true\s*$/.test(line))
			current.deprecation = { ...current.deprecation };
		const since = /^ {6}x-deprecated-since:\s*"?([^"\s]+)"?\s*$/.exec(
			line,
		)?.[1];
		if (since) current.deprecation = { ...current.deprecation, since };
		const sunset = /^ {6}x-sunset:\s*"?([^"\s]+)"?\s*$/.exec(line)?.[1];
		if (sunset) current.deprecation = { ...current.deprecation, sunset };
	}
	return templates;
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
 * `/atlas-releases/compare` is not labelled `/atlas-releases/{release-id}`.
 * A path under `/v1/atlas-releases/{release-id}/` is the pinned form of
 * another operation, and is labelled as that operation under the pin.
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
		if (rest.length >= 3 && rest[0] === "atlas-releases") {
			const operation = find(rest.slice(2));
			return operation
				? {
						route: `/v1${PINNED_PREFIX}${operation.path === "/" ? "" : operation.path}`,
						operation,
						pinnedTo: rest[1],
					}
				: { route: UNMATCHED };
		}
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
