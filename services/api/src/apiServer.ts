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
import { classifyUsage, usageVocabulary } from "./usageLabels";
import { UsageRecorder } from "./usageRecorder";
import { UsageStore, utcDay } from "./usageStore";
import {
	acceptsGzip,
	bodyBytes,
	cachedHttpResponse,
	httpResponse,
	preflightResponse,
	type HttpResponse,
	type SentFile,
} from "./httpResponse";
import {
	createOperationMatcher,
	deprecationHeaders,
	type MatchedOperation,
	unexpectedQueryParameter,
} from "./operationTemplates";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "./postcodeRoutes";
import { clientAddress, clientKey, RateLimiter } from "./rateLimit";
import { ResponseCache } from "./responseCache";
import { isStoredFile, problem, type ApiResponse } from "./routeResponse";
import { routeAsync } from "./routes";
import type { RouteContext } from "./routing";
import {
	DEFAULT_MAX_URL_LENGTH,
	DEFAULT_MAX_CONCURRENT_REQUESTS,
	DEFAULT_MAX_QUEUED_REQUESTS,
	DEFAULT_QUEUE_TIMEOUT_MS,
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

/**
 * The gzip level for a body built per request. On a 2.7 MB country boundary
 * level 4 takes 38 ms against 106 ms at zlib's default of 6, for 3% more
 * bytes; levels above 6 cost several times more for under 1% fewer. Stored
 * files are compressed once at build time, at whatever level that picked.
 */
const GZIP_LEVEL = 4;

const gzipAsync = (body: string | Buffer) =>
	promisify(gzip)(body, { level: GZIP_LEVEL });

type BodyRead =
	{ text: string } | { tooLarge: true; bytes: number } | { aborted: true };

/**
 * A request stream only errors when its connection does, so a failure here is
 * the client going away mid-body, not something the server did wrong.
 */
const readBody = (request: IncomingMessage): Promise<BodyRead> =>
	new Promise((resolve) => {
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
		request.on("error", () => resolve({ aborted: true }));
	});

/**
 * Streams a stored file to the client. A client that goes away mid-download,
 * as a map does when it pans past a tile, tears the whole chain down, so the
 * file is closed rather than left open waiting for a reader that never comes.
 */
export const sendFile = (
	file: SentFile,
	response: ServerResponse,
	onComplete?: (error: Error | null | undefined, bytes: number) => void,
) => {
	const source = createReadStream(file.path, {
		start: file.start,
		end: file.end,
	});
	let bytes = 0;
	const decoder = file.gunzip ? createGunzip() : undefined;
	const output = decoder ?? source;
	const done = (error?: Error | null) => {
		if (!error && bytes !== file.bytes)
			error = new Error(
				"Stored file size does not match its declared length.",
			);
		if (error) response.destroy(error);
		onComplete?.(error, bytes);
	};
	if (decoder) pipeline(source, decoder, response, done);
	else pipeline(source, response, done);
	output.on("data", (chunk: Buffer) => {
		bytes += chunk.length;
	});
	return source;
};

export type ApiServer = Server & {
	/**
	 * Stop reporting ready and close each connection after its current
	 * response, so a load balancer moves traffic away before the process ends.
	 */
	beginDrain(): void;
	readonly metrics: ApiMetrics;
	/** Write buffered usage counts now, for a shutdown that cannot wait. */
	flushUsage(): void;
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
		(route.startsWith("/v1/postcodes") || route === "/v1/areas:contains"
			? DEFAULT_POSTCODE_GEOGRAPHIES.length
			: 1);
	return (matched.operation?.cost ?? 1) * count;
};

export const createApiServer = (
	catalogues: RouteContext,
	options: ServerOptions = {},
): ApiServer => {
	const maxConcurrentRequests =
		options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
	if (
		!Number.isSafeInteger(maxConcurrentRequests) ||
		maxConcurrentRequests < 1 ||
		maxConcurrentRequests > 1024
	)
		throw new Error(
			"maxConcurrentRequests must be an integer between 1 and 1024",
		);
	const maxQueuedRequests =
		options.maxQueuedRequests ?? DEFAULT_MAX_QUEUED_REQUESTS;
	if (
		!Number.isSafeInteger(maxQueuedRequests) ||
		maxQueuedRequests < 0 ||
		maxQueuedRequests > 4096
	)
		throw new Error(
			"maxQueuedRequests must be an integer between 0 and 4096",
		);
	const queueTimeoutMs = options.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;
	if (
		!Number.isSafeInteger(queueTimeoutMs) ||
		queueTimeoutMs < 1 ||
		queueTimeoutMs > 30_000
	)
		throw new Error(
			"queueTimeoutMs must be an integer between 1 and 30000",
		);
	let activeRequests = 0;
	// Requests waiting for a slot, oldest first. Each entry starts its request.
	const queued = new Set<() => void>();
	const releaseId =
		catalogues.atlasRelease?.releaseId ??
		catalogues.boundaryRegistry.contentHash;
	const matchOperation =
		catalogues.operationMatcher ?? (() => ({ route: "unmatched" }));
	const responseCache = options.responseCacheBytes
		? new ResponseCache(options.responseCacheBytes)
		: undefined;
	const metrics = new ApiMetrics(
		releaseId,
		() => catalogues.geographyResolver.geometryCacheStats(),
		() => catalogues.geographyResolver.locationProjectionCacheStats(),
		() => responseCache?.stats(),
	);
	const vocabulary = usageVocabulary(
		catalogues.dataCatalog,
		catalogues.boundaryRegistry,
	);
	// A store that cannot be opened must not stop the API answering: counts
	// then live only in /metrics, and the failure is logged.
	let usage: UsageRecorder | undefined;
	if (options.usage)
		try {
			const store = UsageStore.open(options.usage.directory);
			store.prune(
				utcDay(Date.now() - options.usage.retentionDays * 86_400_000),
			);
			usage = new UsageRecorder(store, {
				onError: (error) =>
					options.log?.({
						level: "error",
						event: "usage.flush_failed",
						error: errorFields(error),
					}),
			});
			usage.start(options.usage.flushIntervalMs);
		} catch (error) {
			options.log?.({
				level: "error",
				event: "usage.store_unavailable",
				error: errorFields(error),
			});
		}
	const limiter = options.rateLimit
		? new RateLimiter(options.rateLimit)
		: undefined;
	const maxUrlLength = options.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH;
	const log = options.log;
	const started = Date.now();
	let draining = false;

	const operations = async (
		request: IncomingMessage,
		pathname: string,
	): Promise<HttpResponse | undefined> => {
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
		const text = options.collectMetrics
			? await options.collectMetrics()
			: metrics.render();
		if (text === null) return json(503, { status: "metrics-unavailable" });
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
		overloaded = false,
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
		// Set when this request's answer should be kept once it is finished.
		let storeAs: string | undefined;

		let result = await operations(request, pathname);
		// Health checks and scrapes are the operator's, not callers asking questions.
		const operational = result !== undefined;
		if (!result && overloaded) {
			matched = matchOperation(pathname);
			result = httpResponse(request, () =>
				problem(
					503,
					"Server Busy",
					"This worker has reached its concurrent request limit. Retry after one second.",
				),
			);
			result.gzip = false;
			result.headers["retry-after"] = "1";
			result.headers.connection = "close";
		}
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
							`This client has exhausted its ${decision.limit}-token allowance on this worker; one token is earned back every ${(1 / options.rateLimit!.refillPerSecond).toFixed(2)} seconds. Retry after ${decision.retryAfterSeconds} seconds, and cache what you have fetched: every response carries an ETag.`,
						),
					);
				} else if (method === "OPTIONS") {
					result = preflightResponse();
				} else if (method === "POST") {
					const read = await readBody(request);
					if ("aborted" in read)
						result = answer(() =>
							problem(
								499,
								"Client Closed Request",
								"The client closed the connection before sending the whole body.",
							),
						);
					else if ("tooLarge" in read)
						result = answer(() =>
							problem(
								413,
								"Content Too Large",
								`The request body is ${read.bytes} bytes or more; at most ${MAX_BODY_BYTES} are read. Split the rows over several requests.`,
							),
						);
					else
						result = await answerAsync(() =>
							routeAsync("POST", target, catalogues, {
								contentType:
									request.headers["content-type"] ?? "",
								text: read.text,
							}),
						);
				} else {
					// An answer is a function of the release and the request, except
					// a remote terrain sample, which is the provider's to change.
					const cacheKey =
						responseCache &&
						method === "GET" &&
						!pathname.startsWith("/v1/terrain/")
							? `${acceptsGzip(request.headers["accept-encoding"]) ? "gzip" : "identity"} ${target}`
							: undefined;
					const kept = cacheKey
						? responseCache!.get(cacheKey)
						: undefined;
					if (kept) {
						result = cachedHttpResponse(request, kept);
					} else {
						storeAs = cacheKey;
						result = await answerAsync(() =>
							routeAsync(
								method === "HEAD" ? "GET" : method,
								target,
								catalogues,
							),
						);
					}
				}
			} catch (error) {
				failure = error;
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

		const entryFor = (status: number, bytes: number) => {
			const code =
				answered && "code" in answered.body
					? answered.body.code
					: undefined;
			return {
				requestId,
				method,
				route: matched.route,
				path: pathname,
				status,
				...(status !== response.statusCode && response.headersSent
					? { httpStatus: response.statusCode }
					: {}),
				durationMs:
					Math.round((performance.now() - startedAt) * 10) / 10,
				bytes,
				...(code ? { code } : {}),
			};
		};
		const reportFailure = (
			error: unknown,
			entry: ReturnType<typeof entryFor>,
		) => {
			// Observability must not turn a recoverable request failure into a
			// process-wide one. Each sink is best effort and independent.
			try {
				metrics.failures.inc({ route: matched.route });
			} catch {}
			try {
				log?.({
					level: "error",
					event: "request.failed",
					...entry,
					error: errorFields(error),
				});
			} catch {}
			try {
				options.onError?.(error, {
					requestId,
					method,
					route: matched.route,
					path: pathname,
				});
			} catch {}
		};
		try {
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
			if (
				storeAs &&
				failure === undefined &&
				result.status === 200 &&
				result.body !== undefined &&
				!isStoredFile(result.body) &&
				result.headers.etag
			)
				responseCache!.set(storeAs, {
					status: 200,
					headers: {
						...result.headers,
						"content-length": String(bodyBytes(result.body)),
					},
					body: result.body,
					etag: result.headers.etag,
				});
			response.writeHead(result.status, headers);
			let status = result.status;
			let bytes = result.body ? bodyBytes(result.body) : 0;
			if (isStoredFile(result.body)) {
				const file = result.body;
				const transfer = await new Promise<{
					error: Error | null | undefined;
					bytes: number;
				}>((resolve) => {
					sendFile(file, response, (error, bytes) =>
						resolve({ error, bytes }),
					);
				});
				bytes = transfer.bytes;
				if (transfer.error) {
					const cancelled =
						"code" in transfer.error &&
						[
							"ERR_STREAM_PREMATURE_CLOSE",
							"ECONNRESET",
							"EPIPE",
						].includes(String(transfer.error.code));
					status = cancelled ? 499 : 500;
					if (!cancelled) failure = transfer.error;
				}
			} else response.end(result.body);

			const durationSeconds = (performance.now() - startedAt) / 1000;
			metrics.observe({
				route: matched.route,
				method,
				status,
				durationSeconds,
				bytes,
			});
			if (!operational && method !== "OPTIONS")
				try {
					const event = classifyUsage(vocabulary, {
						route: matched.route,
						template: matched.operation?.path,
						pathname,
						searchParams: new URLSearchParams(
							target.slice(pathname.length + 1),
						),
						status,
						problem:
							answered && "type" in answered.body
								? answered.body
								: undefined,
					});
					metrics.observeUsage(event);
					usage?.record(event);
				} catch {}
			const entry = entryFor(status, bytes);
			if (failure !== undefined) reportFailure(failure, entry);
			else if (status >= 500)
				log?.({
					level: "warn",
					event: "request.unavailable",
					...entry,
				});
			else if (options.accessLog)
				log?.({ level: "info", event: "request", ...entry });
		} catch (error) {
			// Headers may be invalid or a client may disappear while bytes are being
			// written. A response can no longer be made trustworthy here, so close it
			// and retain the failure without letting the async request escape.
			try {
				response.destroy();
			} catch {}
			reportFailure(error, entryFor(result.status, 0));
		}
	};

	const startQueued = () => {
		for (const start of queued) {
			if (activeRequests >= maxConcurrentRequests) return;
			start();
		}
	};

	const admit = (request: IncomingMessage, response: ServerResponse) => {
		activeRequests += 1;
		let settled = false;
		let finished = false;
		let released = false;
		const release = () => {
			if (!settled || !finished || released) return;
			released = true;
			activeRequests -= 1;
			startQueued();
		};
		const finish = () => {
			finished = true;
			release();
		};
		response.once("finish", finish);
		response.once("close", finish);
		void handle(request, response)
			.catch(() => response.destroy())
			.finally(() => {
				settled = true;
				release();
			});
	};

	const refuse = (request: IncomingMessage, response: ServerResponse) => {
		void handle(request, response, true).catch(() => response.destroy());
	};

	// A queued request's body is left unread until it is admitted, so waiting
	// holds a connection but not its upload.
	const enqueue = (request: IncomingMessage, response: ServerResponse) => {
		if (queued.size >= maxQueuedRequests) return refuse(request, response);
		const leave = () => {
			queued.delete(start);
			clearTimeout(timer);
			response.off("close", leave);
		};
		const start = () => {
			leave();
			admit(request, response);
		};
		const timer = setTimeout(() => {
			leave();
			refuse(request, response);
		}, queueTimeoutMs);
		response.once("close", leave);
		queued.add(start);
	};

	const server = createServer(
		{
			headersTimeout: HEADERS_TIMEOUT_MS,
			requestTimeout: REQUEST_TIMEOUT_MS,
			keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
		},
		(request, response) => {
			const pathname = (request.url ?? "/").split("?", 1)[0]!;
			const exempt =
				request.method === "OPTIONS" ||
				(OPERATIONS_PATHS as readonly string[]).includes(pathname);
			if (exempt)
				void handle(request, response).catch(() => response.destroy());
			else if (activeRequests < maxConcurrentRequests)
				admit(request, response);
			else enqueue(request, response);
		},
	);
	server.on("close", () => {
		metrics.close();
		usage?.close();
	});
	return Object.assign(server, {
		beginDrain: () => {
			draining = true;
			server.closeIdleConnections();
		},
		metrics,
		flushUsage: () => usage?.flush(),
	});
};
