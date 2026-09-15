import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { ApiResponse } from "./routes";

export type HttpResponse = {
	status: number;
	headers: Record<string, string>;
	/** Absent for HEAD requests and 304 responses. */
	body?: string;
};

// A successful response is a function of the Atlas release the server loaded
// and the request URL, so it stays fresh for a few minutes and is then
// revalidated with its ETag. Errors, including a missing catalogue, are not
// stored: the next request may well succeed.
const SUCCESS_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const ERROR_CACHE_CONTROL = "no-store";

/** A strong validator: the SHA-256 of the exact bytes served. */
export const entityTag = (body: string) =>
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
		"content-type":
			result.status >= 400
				? "application/problem+json"
				: (result.representation?.contentType ?? "application/json"),
		"x-content-type-options": "nosniff",
		...result.representation?.headers,
	};
	if (result.status !== 200) {
		headers["cache-control"] = ERROR_CACHE_CONTROL;
		headers["content-length"] = String(Buffer.byteLength(body));
		return { status: result.status, headers, ...(isHead ? {} : { body }) };
	}
	const etag = entityTag(body);
	headers.etag = etag;
	headers["cache-control"] = SUCCESS_CACHE_CONTROL;
	if (matchesEntityTag(request.headers["if-none-match"], etag)) {
		return {
			status: 304,
			headers: {
				etag,
				"cache-control": SUCCESS_CACHE_CONTROL,
			},
		};
	}
	headers["content-length"] = String(Buffer.byteLength(body));
	return { status: 200, headers, ...(isHead ? {} : { body }) };
};
