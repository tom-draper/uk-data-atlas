import { randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import { createGunzip, gzip } from "node:zlib";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { ApiMetrics } from "./apiMetrics";
import {
	bodyBytes,
	httpResponse,
	preflightResponse,
	type HttpResponse,
	type SentFile,
} from "./httpResponse";
import {
	createOperationMatcher,
	deprecationHeaders,
	readOperationTemplates,
	type MatchedOperation,
	unexpectedQueryParameter,
} from "./operationTemplates";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "./postcodeRoutes";
import { clientAddress, clientKey, RateLimiter } from "./rateLimit";
import { isStoredFile, problem, type ApiResponse } from "./routeResponse";
import { routeAsync } from "./routes";
import type { RouteContext } from "./routing";
import {
	DEFAULT_MAX_URL_LENGTH,
	errorFields,
	type ServerOptions,
} from "./serverOptions";

/**
 * Endpoints for whoever runs the server rather than whoever uses the API.
 * They sit outside `/v1`, are not part of the versioned contract, are never
 * cached and are never rate limited: a probe that is refused would take a
 * healthy instance out of service.
 */
export const OPERATIONS_PATHS = ["/healthz", "/readyz", "/metrics"] as const;

// A client may send its own request id so its logs and ours line up; anything
// that could break a log line is replaced with one of ours.
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

// Slow headers and bodies are cut off. Handlers run synchronously, so these
// bound a slow client, not a slow handler.
const HEADERS_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const KEEP_ALIVE_TIMEOUT_MS = 5_000;

/**
 * The largest POST body read. A column of every output area's code with a
 * value is under 5 MB, so this holds any one release's worth of rows; a
 * larger body is refused before it is buffered.
 */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

const gzipAsync = promisify(gzip);

type BodyRead = { text: string } | { tooLarge: true; bytes: number };

const readBody = (request: IncomingMessage): Promise<BodyRead> =>
	new Promise((resolve, reject) => {
		const declared = Number(request.headers["content-length"]);
		if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
			request.resume();
			resolve({ tooLarge: true, bytes: declared });
			return;
		}
		const chunks: Buffer[] = [];
		let bytes = 0;
		request.on("data", (chunk: Buffer) => {
			bytes += chunk.length;
			if (bytes > MAX_BODY_BYTES) {
				request.removeAllListeners("data");
				request.resume();
				resolve({ tooLarge: true, bytes });
				return;
			}
			chunks.push(chunk);
		});
		request.on("end", () =>
			resolve({ text: Buffer.concat(chunks).toString("utf8") }),
		);
		request.on("error", reject);
	});

/**
 * Streams a stored file to the client. A client that goes away mid-download,
 * as a map does when it pans past a tile, tears the whole chain down, so the
 * file is closed rather than left open waiting for a reader that never comes.
 */
export const sendFile = (file: SentFile, response: ServerResponse) => {
	const source = createReadStream(file.path, {
		start: file.start,
		end: file.end,
	});
	const done = (error?: Error | null) => {
		if (error) response.destroy(error);
	};
	if (file.gunzip) pipeline(source, createGunzip(), response, done);
	else pipeline(source, response, done);
	return source;
};

export type ApiServer = Server & {
	/**
	 * Stop reporting ready and close each connection after its current
	 * response, so a load balancer moves traffic away before the process ends.
	 */
	beginDrain(): void;
	readonly metrics: ApiMetrics;
};

const json = (status: number, body: unknown): HttpResponse => {
	const text = `${JSON.stringify(body)}\n`;
	return {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
			"content-length": String(Buffer.byteLength(text)),
		},
		body: text,
	};
};

const bearerMatches = (header: string | undefined, token: string) => {
	const presented = Buffer.from(
		/^Bearer (.+)$/i.exec(header ?? "")?.[1] ?? "",
	);
	const expected = Buffer.from(token);
	return (
		presented.length === expected.length &&
		timingSafeEqual(presented, expected)
	);
};

/**
 * Point lookups do one spatial search per requested geography. Their declared
 * operation cost covers request shape (for example, a batch); multiply it by
 * the distinct releases a caller asks to search so rotating wide requests
 * cannot evade the cost of their geometry work.
 */
const pointLookupCost = (matched: MatchedOperation, target: string) => {
	const route = matched.route;
	if (
		route !== "/v1/areas:contains" &&
		route !== "/v1/areas:containsBatch" &&
		route !== "/v1/postcodes/{postcode}" &&
		route !== "/v1/postcodes:batch"
	)
		return matched.operation?.cost;
	const query = new URL(target, "http://localhost").searchParams;
	const geographies = new Set(
		query
			.getAll("geography")
			.flatMap((value) => value.split(","))
			.map((value) => value.trim())
			.filter(Boolean),
	);
	for (const value of query.getAll("release")) {
		const slash = value.indexOf("/");
		if (slash > 0) geographies.add(value.slice(0, slash));
	}
	const count =
		geographies.size ||
		(route.startsWith("/v1/postcodes")
			? DEFAULT_POSTCODE_GEOGRAPHIES.length
			: 1);
	return (matched.operation?.cost ?? 1) * count;
};

export const createApiServer = (
	catalogues: RouteContext,
	options: ServerOptions = {},
): ApiServer => {
	const releaseId =
		catalogues.atlasRelease?.releaseId ??
		catalogues.boundaryRegistry.contentHash;
	const matchOperation = createOperationMatcher(
		readOperationTemplates(catalogues.openapiDocument ?? ""),
	);
	const metrics = new ApiMetrics(releaseId, () =>
		catalogues.geographyResolver.geometryCacheStats(),
	);
	const limiter = options.rateLimit
		? new RateLimiter(options.rateLimit)
		: undefined;
	const maxUrlLength = options.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH;
	const log = options.log;
	const started = Date.now();
	let draining = false;

	const operations = (
		request: IncomingMessage,
		pathname: string,
	): HttpResponse | undefined => {
		if (!(OPERATIONS_PATHS as readonly string[]).includes(pathname))
			return undefined;
		if (request.method !== "GET" && request.method !== "HEAD")
			return json(405, { status: "method-not-allowed" });
		if (pathname === "/healthz") return json(200, { status: "ok" });
		if (pathname === "/readyz")
			return json(draining ? 503 : 200, {
				status: draining ? "draining" : "ready",
				apiVersion: "v1",
				atlasRelease: releaseId,
				uptimeSeconds: Math.round((Date.now() - started) / 1000),
				geometryCache:
					catalogues.geographyResolver.geometryCacheStats() ?? null,
			});
		if (!options.metrics) return json(404, { status: "not-found" });
		if (
			options.metrics !== "open" &&
			!bearerMatches(request.headers.authorization, options.metrics.token)
		) {
			const refused = json(401, { status: "unauthorised" });
			refused.headers["www-authenticate"] = 'Bearer realm="metrics"';
			return refused;
		}
		const text = metrics.render();
		return {
			status: 200,
			headers: {
				"content-type": "text/plain; version=0.0.4; charset=utf-8",
				"cache-control": "no-store",
				"content-length": String(Buffer.byteLength(text)),
			},
			body: text,
		};
	};

	const handle = async (
		request: IncomingMessage,
		response: ServerResponse,
	) => {
		const startedAt = performance.now();
		const incomingId = request.headers["x-request-id"];
		const requestId =
			typeof incomingId === "string" && REQUEST_ID.test(incomingId)
				? incomingId
				: randomUUID();
		const target = request.url ?? "/";
		const pathname = target.split("?", 1)[0]!;
		const method = request.method ?? "GET";
		let matched: MatchedOperation = { route: pathname };
		let answered: ApiResponse | undefined;
		let failure: unknown;
		let limitHeaders: Record<string, string> = {};

		let result = operations(request, pathname);
		if (!result) {
			matched = matchOperation(pathname);
			const unexpected = unexpectedQueryParameter(
				matched.operation,
				method,
				target,
			);
			const queryProblem = unexpected
				? problem(
						400,
						"Unknown Query Parameter",
						`This operation does not accept the query parameter ${unexpected.parameter}.`,
						{ code: "unknown_query_parameter", ...unexpected },
					)
				: undefined;
			const decision =
				!queryProblem && limiter && method !== "OPTIONS"
					? limiter.take(
							clientKey(
								clientAddress(
									request,
									options.rateLimit?.trustedProxyHops,
								),
							),
							pointLookupCost(matched, target),
						)
					: undefined;
			if (decision) limitHeaders = limiter!.headers(decision);
			const answer = (produce: (routedMethod?: string) => ApiResponse) =>
				httpResponse(request, (routedMethod) => {
					answered = produce(routedMethod);
					return answered;
				});
			const answerAsync = async (produce: () => Promise<ApiResponse>) => {
				answered = await produce();
				return httpResponse(request, () => answered!);
			};
			try {
				if (queryProblem) {
					result = answer(() => queryProblem);
				} else if (target.length > maxUrlLength) {
					result = answer(() =>
						problem(
							414,
							"URI Too Long",
							`The request target is ${target.length} characters; at most ${maxUrlLength} are served. A long list of points or codes belongs in several smaller requests.`,
						),
					);
				} else if (decision && !decision.allowed) {
					metrics.rateLimited.inc();
					result = answer(() =>
						problem(
							429,
							"Too Many Requests",
							`This client has used its ${decision.limit} requests; one is earned back every ${(1 / options.rateLimit!.refillPerSecond).toFixed(2)} seconds. Retry after ${decision.retryAfterSeconds} seconds, and cache what you have fetched: every response carries an ETag.`,
						),
					);
				} else if (method === "OPTIONS") {
					result = preflightResponse();
				} else if (method === "POST") {
					const read = await readBody(request);
					result =
						"tooLarge" in read
							? answer(() =>
									problem(
										413,
										"Content Too Large",
										`The request body is ${read.bytes} bytes or more; at most ${MAX_BODY_BYTES} are read. Split the rows over several requests.`,
									),
								)
							: await answerAsync(() =>
									routeAsync("POST", target, catalogues, {
										contentType:
											request.headers["content-type"] ??
											"",
										text: read.text,
									}),
								);
				} else {
					result = await answerAsync(() =>
						routeAsync(
							method === "HEAD" ? "GET" : method,
							target,
							catalogues,
						),
					);
				}
			} catch (error) {
				failure = error;
				metrics.failures.inc({ route: matched.route });
				result = httpResponse({ method, headers: {} }, () => {
					answered = problem(
						500,
						"Internal Server Error",
						"The server failed to answer this request. It has been logged; quote requestId when reporting it.",
						{ requestId },
					);
					return answered;
				});
			}
		}

		const headers: Record<string, string> = {
			...result.headers,
			...limitHeaders,
			...deprecationHeaders(matched.operation),
			"x-request-id": requestId,
			"atlas-release": releaseId,
			...(draining ? { connection: "close" } : {}),
		};
		// Compressed on the libuv thread pool, so a large body does not hold up
		// every other request while it is encoded.
		if (
			result.gzip &&
			result.body !== undefined &&
			!isStoredFile(result.body)
		) {
			const encoded = await gzipAsync(result.body);
			result = { ...result, body: encoded };
			headers["content-length"] = String(encoded.length);
		}
		response.writeHead(result.status, headers);
		if (isStoredFile(result.body)) sendFile(result.body, response);
		else response.end(result.body);

		const durationSeconds = (performance.now() - startedAt) / 1000;
		const bytes = result.body ? bodyBytes(result.body) : 0;
		metrics.observe({
			route: matched.route,
			method,
			status: result.status,
			durationSeconds,
			bytes,
		});
		const code =
			answered && "code" in answered.body
				? answered.body.code
				: undefined;
		const entry = {
			requestId,
			method,
			route: matched.route,
			path: pathname,
			status: result.status,
			durationMs: Math.round(durationSeconds * 1000 * 10) / 10,
			bytes,
			...(code ? { code } : {}),
		};
		if (failure !== undefined) {
			log?.({
				level: "error",
				event: "request.failed",
				...entry,
				error: errorFields(failure),
			});
			options.onError?.(failure, {
				requestId,
				method,
				route: matched.route,
				path: pathname,
			});
		} else if (result.status >= 500) {
			log?.({ level: "warn", event: "request.unavailable", ...entry });
		} else if (options.accessLog) {
			log?.({ level: "info", event: "request", ...entry });
		}
	};

	const server = createServer(
		{
			headersTimeout: HEADERS_TIMEOUT_MS,
			requestTimeout: REQUEST_TIMEOUT_MS,
			keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
		},
		handle,
	);
	server.on("close", () => metrics.close());
	return Object.assign(server, {
		beginDrain: () => {
			draining = true;
			server.closeIdleConnections();
		},
		metrics,
	});
};
