import { randomUUID, timingSafeEqual } from "node:crypto";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { ApiMetrics } from "./apiMetrics";
import {
	httpResponse,
	preflightResponse,
	type HttpResponse,
} from "./httpResponse";
import {
	createOperationMatcher,
	deprecationHeaders,
	readOperationTemplates,
	type MatchedOperation,
} from "./operationTemplates";
import { clientAddress, clientKey, RateLimiter } from "./rateLimit";
import { problem, type ApiResponse } from "./routeResponse";
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
		if (
			options.metricsToken &&
			!bearerMatches(request.headers.authorization, options.metricsToken)
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
			const decision =
				limiter && method !== "OPTIONS"
					? limiter.take(
							clientKey(
								clientAddress(
									request,
									options.rateLimit?.trustedProxyHops,
								),
							),
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
				if (target.length > maxUrlLength) {
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
		response.writeHead(result.status, headers);
		response.end(result.body);

		const durationSeconds = (performance.now() - startedAt) / 1000;
		const bytes = result.body ? Buffer.byteLength(result.body) : 0;
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
			...(matched.pinnedTo ? { pinnedTo: matched.pinnedTo } : {}),
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
