import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { CachedAnswer } from "./responseCache";
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
	/**
	 * The body is to be sent gzipped. Compressing is left to the server so it
	 * can be done off the event loop; the headers already say it is encoded,
	 * and `content-length` is set once the encoded size is known.
	 */
	gzip?: boolean;
};

/**
 * A stored file as the server sends it: which bytes, and whether to decode
 * them. `start` and `end` (inclusive) pick out one byte range of it.
 */
export type SentFile = {
	path: string;
	bytes: number;
	gunzip: boolean;
	start?: number;
	end?: number;
};

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
 * revalidate or page, which are both part of the contract. `Content-Location`
 * names the canonical request a measure alias was read as. The release and
 * request id identify an answer, and the rate limit, `Retry-After`,
 * `Deprecation` and `Sunset` fields tell a browser client when to slow down or
 * move on, so they are exposed too. `If-None-Match` is
 * not a safelisted request header, so a conditional request preflights and the
 * answer to that preflight has to allow it.
 */
const CROSS_ORIGIN: Record<string, string> = {
	"access-control-allow-origin": "*",
	"access-control-expose-headers":
		"etag, link, content-encoding, content-location, content-range, accept-ranges, atlas-release, x-request-id, ratelimit, ratelimit-policy, retry-after, deprecation, sunset",
};

const PREFLIGHT: Record<string, string> = {
	...CROSS_ORIGIN,
	"access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
	"access-control-allow-headers":
		"if-none-match, if-range, range, accept, content-type, x-request-id",
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

/**
 * What is worth compressing: text and vector tiles, which shrink several
 * times over. Parquet and PMTiles are compressed inside already.
 */
const COMPRESSIBLE =
	/^(?:text\/|application\/(?:json|problem\+json|geo\+json|x-ndjson|yaml|vnd\.mapbox-vector-tile)\b)/;

/** Below this the gzip header costs more than it saves. */
export const MIN_COMPRESSED_BYTES = 1024;

/** The validator of the gzipped form of a body, which is different bytes. */
const gzippedTag = (etag: string) => `${etag.slice(0, -1)}-gzip"`;

/** Whether a client will take a gzip-encoded body, per RFC 9110 section 12.5.3. */
export const acceptsGzip = (header: string | string[] | undefined) =>
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

/**
 * The one byte range a `Range` header asks of a file `size` bytes long, per
 * RFC 9110 section 14. A header this server does not honour, several ranges
 * or a malformed one, is ignored and the whole file sent, as the RFC allows.
 * A range that starts past the end cannot be satisfied.
 */
export const requestedRange = (
	header: string | undefined,
	size: number,
): { start: number; end: number } | "unsatisfiable" | undefined => {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
	if (!match || (match[1] === "" && match[2] === "")) return undefined;
	if (match[1] === "") {
		// A suffix: the last n bytes.
		const length = Number(match[2]);
		if (length === 0) return "unsatisfiable";
		return { start: Math.max(0, size - length), end: size - 1 };
	}
	const start = Number(match[1]);
	const end = match[2] === "" ? Infinity : Number(match[2]);
	if (end < start) return undefined;
	if (start >= size) return "unsatisfiable";
	return { start, end: Math.min(end, size - 1) };
};

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

const notModified = (etag: string, vary: string | undefined): HttpResponse => ({
	status: 304,
	headers: {
		...CROSS_ORIGIN,
		etag,
		"cache-control": SUCCESS_CACHE_CONTROL,
		...(vary ? { vary } : {}),
	},
});

/**
 * The wire response for a GET answered earlier: the stored answer, or `304`
 * when the client already holds it. Never a stored file or a ranged read,
 * which are streamed from disk and not kept.
 */
export const cachedHttpResponse = (
	request: { headers: IncomingHttpHeaders },
	answer: CachedAnswer,
): HttpResponse =>
	matchesEntityTag(request.headers["if-none-match"], answer.etag)
		? notModified(answer.etag, answer.headers.vary)
		: { status: answer.status, headers: answer.headers, body: answer.body };

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
		...result.headers,
		...(stored?.gzipBytes !== undefined ? { vary: "accept-encoding" } : {}),
		...(gzipped ? { "content-encoding": "gzip" } : {}),
	};
	// A body built for this request is compressed for a client that takes it,
	// as a stored file is, unless its route has already encoded it.
	const compressible =
		!stored &&
		headers["content-encoding"] === undefined &&
		COMPRESSIBLE.test(headers["content-type"] ?? "");
	const compress =
		compressible &&
		bodyBytes(body) >= MIN_COMPRESSED_BYTES &&
		acceptsGzip(request.headers["accept-encoding"]);
	if (compressible) headers.vary = "accept-encoding";
	if (compress) headers["content-encoding"] = "gzip";

	// A tile that covers no area answers 204, which is an ordinary answer and
	// is cached like any other; only a failure is left unstored. An answer to
	// a POST is a function of its body, which no cache keys on, so it is
	// never stored either.
	if (result.status >= 400 || request.method === "POST") {
		headers["cache-control"] = ERROR_CACHE_CONTROL;
		return withBody(result.status, headers, body, isHead, compress);
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
		: compress
			? gzippedTag(entityTag(body as string | Buffer))
			: entityTag(body as string | Buffer);
	headers.etag = etag;
	headers["cache-control"] = freshness;
	if (matchesEntityTag(request.headers["if-none-match"], etag))
		return notModified(etag, headers.vary);
	// A file sent as it is stored can be read in pieces, which is how a
	// PMTiles client reads an archive: the header, then a directory, then
	// the tiles it needs, never the whole file.
	if (stored && stored.gzipBytes === undefined && result.status === 200) {
		headers["accept-ranges"] = "bytes";
		const ifRange = [request.headers["if-range"]].flat()[0];
		const range =
			ifRange === undefined || ifRange.trim() === etag
				? requestedRange(request.headers.range, stored.bytes)
				: undefined;
		if (range === "unsatisfiable")
			return {
				status: 416,
				headers: {
					...CROSS_ORIGIN,
					"content-range": `bytes */${stored.bytes}`,
					"cache-control": ERROR_CACHE_CONTROL,
					"content-length": "0",
				},
			};
		if (range) {
			const part: SentFile = {
				path: stored.path,
				bytes: range.end - range.start + 1,
				gunzip: false,
				start: range.start,
				end: range.end,
			};
			headers["content-range"] =
				`bytes ${range.start}-${range.end}/${stored.bytes}`;
			headers["content-length"] = String(part.bytes);
			return { status: 206, headers, ...(isHead ? {} : { body: part }) };
		}
	}
	return withBody(result.status, headers, body, isHead, compress);
};

/**
 * The response with its body, or for HEAD without it. A body still to be
 * gzipped has no length until it is, so the server sets it then; a HEAD
 * answer to such a body carries none.
 */
const withBody = (
	status: number,
	headers: Record<string, string>,
	body: string | Buffer | SentFile,
	isHead: boolean,
	gzip: boolean,
): HttpResponse => {
	if (gzip)
		return { status, headers, ...(isHead ? {} : { body, gzip: true }) };
	headers["content-length"] = String(bodyBytes(body));
	return { status, headers, ...(isHead ? {} : { body }) };
};
