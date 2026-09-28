import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { ApiResponse } from "./routeResponse";

export type HttpResponse = {
	status: number;
	headers: Record<string, string>;
	/** Absent for HEAD requests, 204 and 304 responses. */
	body?: string | Buffer;
};

// A successful response is a function of the Atlas release the server loaded
// and the request URL, so it stays fresh for a few minutes and is then
// revalidated with its ETag. Errors, including a missing catalogue, are not
// stored: the next request may well succeed.
const SUCCESS_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const ERROR_CACHE_CONTROL = "no-store";
// A response pinned to an Atlas release is a function of that release alone,
// so it can be kept for a year and never revalidated. The release it names
// stops being served when the Atlas rebuilds, and a copy already held stays
// correct for exactly as long as it is a copy of that release.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * This is a read-only API over openly licensed data, and its most obvious
 * client is a map running in someone else's page. Without these a browser
 * fetches a tile and then refuses to let the page read it.
 *
 * `ETag` and `Link` are exposed because a client that cannot read them cannot
 * revalidate or page, which are both part of the contract. The release and
 * request id identify an answer, and the rate limit, `Retry-After`,
 * `Deprecation` and `Sunset` fields tell a browser client when to slow down or
 * move on, so they are exposed too. `If-None-Match` is
 * not a safelisted request header, so a conditional request preflights and the
 * answer to that preflight has to allow it.
 */
const CROSS_ORIGIN: Record<string, string> = {
	"access-control-allow-origin": "*",
	"access-control-expose-headers":
		"etag, link, content-encoding, atlas-release, x-request-id, ratelimit, ratelimit-policy, retry-after, deprecation, sunset",
};

const PREFLIGHT: Record<string, string> = {
	...CROSS_ORIGIN,
	"access-control-allow-methods": "GET, HEAD, OPTIONS",
	"access-control-allow-headers": "if-none-match, accept, x-request-id",
	"access-control-max-age": "86400",
};

/** A browser asking whether it may make the request it is about to make. */
export const preflightResponse = (): HttpResponse => ({
	status: 204,
	headers: { ...PREFLIGHT, "cache-control": SUCCESS_CACHE_CONTROL },
});

/** A strong validator: the SHA-256 of the exact bytes served. */
export const entityTag = (body: string | Buffer) =>
	`"sha256-${createHash("sha256").update(body).digest("base64url")}"`;

/**
 * Whether an `If-None-Match` header matches the current validator, using the
 * weak comparison RFC 9110 requires for this header.
 */
export const matchesEntityTag = (
	ifNoneMatch: string | string[] | undefined,
	etag: string,
) => {
	if (ifNoneMatch === undefined) return false;
	const opaque = (tag: string) => tag.trim().replace(/^W\//, "");
	return (Array.isArray(ifNoneMatch) ? ifNoneMatch : [ifNoneMatch])
		.flatMap((value) => value.split(","))
		.some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag));
};

/**
 * Turns a route result into what goes on the wire. The route itself stays
 * independent of HTTP: HEAD is answered as GET without a body, and a
 * conditional GET or HEAD whose validator still matches gets 304.
 */
export const httpResponse = (
	request: { method?: string; headers: IncomingHttpHeaders },
	route: (method: string | undefined) => ApiResponse,
): HttpResponse => {
	const isHead = request.method === "HEAD";
	const result = route(isHead ? "GET" : request.method);
	const body =
		result.representation?.body ?? `${JSON.stringify(result.body)}\n`;
	const headers: Record<string, string> = {
		...CROSS_ORIGIN,
		"content-type":
			result.status >= 400
				? "application/problem+json"
				: (result.representation?.contentType ?? "application/json"),
		"x-content-type-options": "nosniff",
		...result.representation?.headers,
	};
	// A tile that covers no area answers 204, which is an ordinary answer and
	// is cached like any other; only a failure is left unstored.
	if (result.status >= 400) {
		headers["cache-control"] = ERROR_CACHE_CONTROL;
		headers["content-length"] = String(Buffer.byteLength(body));
		return { status: result.status, headers, ...(isHead ? {} : { body }) };
	}
	// 204 says there is nothing to send, so it carries neither a body nor a
	// validator to revalidate one with.
	const freshness =
		result.cache === "immutable"
			? IMMUTABLE_CACHE_CONTROL
			: SUCCESS_CACHE_CONTROL;
	if (result.status === 204)
		return {
			status: 204,
			headers: { ...headers, "cache-control": freshness },
		};
	const etag = entityTag(body);
	headers.etag = etag;
	headers["cache-control"] = freshness;
	if (matchesEntityTag(request.headers["if-none-match"], etag)) {
		return {
			status: 304,
			headers: {
				...CROSS_ORIGIN,
				etag,
				"cache-control": freshness,
			},
		};
	}
	headers["content-length"] = String(Buffer.byteLength(body));
	return { status: result.status, headers, ...(isHead ? {} : { body }) };
};
