import type { ApiResult, Failure, Problem } from "./client.ts";

export interface TextResult {
	[key: string]: unknown;
	content: { type: "text"; text: string }[];
	isError?: boolean;
}

/** Longest answer returned whole, in characters, to keep a reply readable. */
export const MAX_CHARS = 40_000;

const text = (value: string, isError = false): TextResult => ({
	content: [{ type: "text", text: value }],
	...(isError ? { isError: true } : {}),
});

const compact = (value: unknown) => JSON.stringify(value);

/**
 * A successful answer as compact JSON. The API's `data` is passed through
 * untouched, so `defaults`, `method`, `otherMatches` and attribution survive.
 * Only the envelope is slimmed: the request URL is added so the answer can be
 * cited, and the paging cursor is kept only when there is another page.
 */
export function success(
	request: string,
	body: unknown,
	transform: (data: unknown) => unknown = (data) => data,
): TextResult {
	const envelope = (body ?? {}) as {
		atlasRelease?: unknown;
		data?: unknown;
		meta?: { nextCursor?: unknown };
	};
	const out: Record<string, unknown> = {
		request,
		atlasRelease: envelope.atlasRelease,
		data: transform(envelope.data),
	};
	if (envelope.meta?.nextCursor) out.nextCursor = envelope.meta.nextCursor;
	const json = compact(out);
	if (json.length <= MAX_CHARS) return text(json);
	return text(
		`${json.slice(0, MAX_CHARS)}\n[truncated: the full answer is ${json.length} characters. ` +
			`Ask a narrower question (a smaller limit, a specific geography or period) to see the rest.]`,
	);
}

const describe = (problem: Problem) => {
	const { type, title, detail, status, code, choices, candidates } = problem;
	return compact({
		status,
		title,
		code,
		detail,
		type,
		...(choices ? { choices } : {}),
		...(candidates ? { candidates } : {}),
	});
};

/** What to do next, per status, written for a model rather than a developer. */
function advice(failure: Failure): string {
	const { status, problem } = failure;
	if (status === 409) {
		return (
			"The name is ambiguous. Nothing was chosen for you. Pick one of the `choices` " +
			"(ask the user if it is unclear) and repeat the call with its place reference " +
			"(for example `localAuthority/W06000022`) as `place`."
		);
	}
	if (status === 404) {
		return (
			"Nothing was found for that input. Check the spelling or code, or search with " +
			"`find_place` or `find_measures` first. Do not guess a value."
		);
	}
	if (status === 422) {
		return (
			"The API understood the request but refuses to answer it, usually because the " +
			"measure is not published for that place or cannot be combined that way. " +
			"Report the reason rather than estimating."
		);
	}
	if (status === 429) {
		const wait = failure.retryAfter
			? ` Wait ${failure.retryAfter} seconds before trying again.`
			: " Wait a little before trying again.";
		return `The API is rate limiting this client.${wait}`;
	}
	if (status === 503) {
		return "The API is busy or still loading. Retry shortly with backoff.";
	}
	if (status === 400) {
		return "The request was invalid. Fix the parameters named in `detail` and retry.";
	}
	if (status === 0) {
		return "The API could not be reached. Say so rather than answering from memory.";
	}
	return problem.detail ? "" : "The API returned an error.";
}

/** An API refusal as a tool error the model can act on. */
export function failure(request: string, result: Failure): TextResult {
	const lines = [
		`The API refused this request (${result.status || "no response"}): ${request}`,
		describe(result.problem),
	];
	const hint = advice(result);
	if (hint) lines.push(hint);
	return text(lines.join("\n"), true);
}

/** A mistake in the tool's own input, caught before any request is made. */
export const inputError = (message: string): TextResult => text(message, true);

export const render = (
	request: string,
	result: ApiResult,
	transform?: (data: unknown) => unknown,
): TextResult =>
	result.ok
		? success(request, result.body, transform)
		: failure(request, result);
