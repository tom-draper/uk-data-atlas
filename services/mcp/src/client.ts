/**
 * A thin read-only client over the public API. It sends GET requests only,
 * carries no credentials, and hands back the API's own envelope or problem
 * unchanged so that `defaults`, `method` and attribution reach the model.
 */

export const DEFAULT_BASE_URL = "https://api.ukdataatlas.com/v1";

export type Query = Record<
	string,
	string | number | boolean | readonly string[] | undefined
>;

export type FetchLike = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export interface ClientOptions {
	baseUrl?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
}

/** RFC 9457 problem details as the API serves them, with its extensions. */
export interface Problem {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	code?: string;
	choices?: unknown[];
	candidates?: unknown[];
	[key: string]: unknown;
}

export interface Success {
	ok: true;
	status: number;
	body: unknown;
}

export interface Failure {
	ok: false;
	status: number;
	problem: Problem;
	/** Seconds to wait, from `Retry-After`, when the API asked the client to. */
	retryAfter?: number;
}

export type ApiResult = Success | Failure;

export interface ApiClient {
	/** The base URL requests go to, without a trailing slash. */
	readonly baseUrl: string;
	/** The base URL's origin, for turning root-relative links into full ones. */
	readonly origin: string;
	get(path: string, query?: Query): Promise<ApiResult>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Percent-encode one path segment, so a code or name cannot change the route. */
export const segment = (value: string) => encodeURIComponent(value.trim());

export function buildUrl(baseUrl: string, path: string, query: Query = {}) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue;
		// A list is sent comma separated, which the API accepts for every
		// array parameter, so one name never needs repeating.
		if (typeof value === "object") {
			if (value.length > 0) params.set(key, value.join(","));
			continue;
		}
		if (value === "") continue;
		params.set(key, String(value));
	}
	const search = params.toString();
	return `${baseUrl}${path}${search ? `?${search}` : ""}`;
}

const retryAfterSeconds = (response: Response) => {
	const seconds = Number(response.headers.get("retry-after"));
	return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
};

async function readProblem(response: Response): Promise<Problem> {
	const text = await response.text();
	try {
		const parsed: unknown = JSON.parse(text);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return { status: response.status, ...(parsed as Problem) };
		}
	} catch {
		// Not JSON: a proxy error page, say. Fall through to a plain problem.
	}
	return {
		status: response.status,
		title: response.statusText || `HTTP ${response.status}`,
		detail: text.slice(0, 300),
	};
}

export function createClient(options: ClientOptions = {}): ApiClient {
	const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
	const doFetch: FetchLike =
		options.fetch ?? ((input, init) => fetch(input, init));
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const origin = new URL(baseUrl).origin;

	return {
		baseUrl,
		origin,
		async get(path, query) {
			const url = buildUrl(baseUrl, path, query);
			let response: Response;
			try {
				response = await doFetch(url, {
					method: "GET",
					headers: { accept: "application/json" },
					signal: AbortSignal.timeout(timeoutMs),
				});
			} catch (error) {
				const timedOut =
					error instanceof Error &&
					(error.name === "TimeoutError" ||
						error.name === "AbortError");
				return {
					ok: false,
					status: 0,
					problem: {
						title: timedOut
							? "Request timed out"
							: "API unreachable",
						detail: timedOut
							? `No answer from ${baseUrl} within ${timeoutMs} ms.`
							: `Could not reach ${baseUrl}: ${
									error instanceof Error
										? error.message
										: String(error)
								}`,
					},
				};
			}
			if (!response.ok) {
				return {
					ok: false,
					status: response.status,
					problem: await readProblem(response),
					retryAfter: retryAfterSeconds(response),
				};
			}
			const text = await response.text();
			try {
				return {
					ok: true,
					status: response.status,
					body: JSON.parse(text),
				};
			} catch {
				return {
					ok: false,
					status: response.status,
					problem: {
						title: "Unexpected response",
						detail: `${url} did not return JSON.`,
					},
				};
			}
		},
	};
}
