import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import {
	isStoredFile,
	type ApiResponse,
	type StoredFile,
} from "./routeResponse";

export type HttpResponse = {
	status: number;
	headers: Record<string, string>;
	/**
	 * Absent for HEAD requests, 204 and 304 responses. A stored file is
	 * streamed from disk by the server.
	 */
	body?: string | Buffer | SentFile;
};

/** A stored file as the server sends it: which bytes, and whether to decode them. */
export type SentFile = { path: string; bytes: number; gunzip: boolean };

// A successful response is a function of the Atlas release the server loaded
// and the request URL, so it stays fresh for a few minutes and is then
// revalidated with its ETag. Errors, including a missing catalogue, are not
// stored: the next request may well succeed.
const SUCCESS_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const ERROR_CACHE_CONTROL = "no-store";

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
 * The same validator, from a hash the build recorded rather than the bytes.
 * The gzipped form of a representation is different bytes, so it has its own.
 */
const storedEntityTag = (file: StoredFile, gzipped: boolean) =>
	`"sha256-${Buffer.from(file.contentHash.replace(/^sha256:/, ""), "hex").toString("base64url")}${gzipped ? "-gzip" : ""}"`;

/** Whether a client will take a gzip-encoded body, per RFC 9110 section 12.5.3. */
const acceptsGzip = (header: string | string[] | undefined) =>
	(Array.isArray(header) ? header.join(",") : (header ?? ""))
		.split(",")
		.some((entry) => {
			const [coding, ...parameters] = entry
				.trim()
				.toLowerCase()
				.split(";");
			if (coding !== "gzip" && coding !== "*") return false;
			const q = parameters
				.map((parameter) => parameter.trim())
				.find((parameter) => parameter.startsWith("q="));
			return q === undefined || Number(q.slice(2)) > 0;
		});

/** How many bytes a body puts on the wire. */
export const bodyBytes = (body: string | Buffer | SentFile) =>
	isStoredFile(body) ? body.bytes : Buffer.byteLength(body);

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
	const represented =
		result.representation?.body ?? `${JSON.stringify(result.body)}\n`;
	const stored = isStoredFile<StoredFile>(represented)
		? represented
		: undefined;
	const gzipped =
		stored?.gzipBytes !== undefined &&
		acceptsGzip(request.headers["accept-encoding"]);
	const body: string | Buffer | SentFile = stored
		? {
				path: stored.path,
				bytes: gzipped ? stored.gzipBytes! : stored.bytes,
				gunzip: stored.gzipBytes !== undefined && !gzipped,
			}
		: (represented as string | Buffer);
	const headers: Record<string, string> = {
		...CROSS_ORIGIN,
		"content-type":
			result.status >= 400
				? "application/problem+json"
				: (result.representation?.contentType ?? "application/json"),
		"x-content-type-options": "nosniff",
		...result.representation?.headers,
		...(stored?.gzipBytes !== undefined ? { vary: "accept-encoding" } : {}),
		...(gzipped ? { "content-encoding": "gzip" } : {}),
	};
	// A tile that covers no area answers 204, which is an ordinary answer and
	// is cached like any other; only a failure is left unstored.
	if (result.status >= 400) {
		headers["cache-control"] = ERROR_CACHE_CONTROL;
		headers["content-length"] = String(bodyBytes(body));
		return { status: result.status, headers, ...(isHead ? {} : { body }) };
	}
	// 204 says there is nothing to send, so it carries neither a body nor a
	// validator to revalidate one with.
	const freshness = SUCCESS_CACHE_CONTROL;
	if (result.status === 204)
		return {
			status: 204,
			headers: { ...headers, "cache-control": freshness },
		};
	const etag = stored
		? storedEntityTag(stored, gzipped)
		: entityTag(body as string | Buffer);
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
	headers["content-length"] = String(bodyBytes(body));
	return { status: result.status, headers, ...(isHead ? {} : { body }) };
};
