import type { RateLimitPolicy } from "./rateLimit";

/** One structured log line. Written as JSON, one object per line. */
export type LogEntry = {
	level: "info" | "warn" | "error";
	event: string;
	[field: string]: unknown;
};

export type ServerOptions = {
	/** Absent, requests are not limited. */
	rateLimit?: RateLimitPolicy & {
		/** Proxies in front of the server that append to X-Forwarded-For. */
		trustedProxyHops?: number;
	};
	/** Absent, nothing is logged. */
	log?: (entry: LogEntry) => void;
	/** Log every request, not only failures. */
	accessLog?: boolean;
	/**
	 * Called with every exception a request raised, after it is logged and
	 * answered 500: the place to forward it to an error tracker.
	 */
	onError?: (
		error: unknown,
		request: {
			requestId: string;
			method: string;
			route: string;
			path: string;
		},
	) => void;
	/** Absent, `/metrics` is open; present, it needs `Authorization: Bearer`. */
	metricsToken?: string;
	/** Longest request target served; a longer one is refused with 414. */
	maxUrlLength?: number;
};

export const DEFAULT_MAX_URL_LENGTH = 4096;

export type ServeConfiguration = {
	port: number;
	host: string;
	geometryCacheReleases: number;
	shutdownGraceSeconds: number;
	server: ServerOptions;
	terrainRemoteEndpoint?: string;
	terrainCoverageEndpoint?: string;
	terrainRemoteTimeoutMs: number;
	terrainRemoteConcurrency: number;
};

const integer = (
	env: NodeJS.ProcessEnv,
	name: string,
	fallback: number,
	minimum: number,
	maximum = Number.MAX_SAFE_INTEGER,
) => {
	const raw = env[name];
	if (raw === undefined || raw === "") return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < minimum || value > maximum)
		throw new Error(
			`${name} must be an integer between ${minimum} and ${maximum}.`,
		);
	return value;
};

const positive = (env: NodeJS.ProcessEnv, name: string, fallback: number) => {
	const raw = env[name];
	if (raw === undefined || raw === "") return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0)
		throw new Error(`${name} must be a positive number.`);
	return value;
};

const toggle = (env: NodeJS.ProcessEnv, name: string, fallback: boolean) => {
	const raw = env[name]?.toLowerCase();
	if (raw === undefined || raw === "") return fallback;
	if (["1", "true", "on", "yes"].includes(raw)) return true;
	if (["0", "false", "off", "no"].includes(raw)) return false;
	throw new Error(`${name} must be on or off.`);
};

/**
 * The server's configuration from its environment. Every setting has a
 * default suited to a single public instance, and a malformed value stops the
 * server starting rather than being quietly replaced by that default.
 */
export const readServeConfiguration = (
	env: NodeJS.ProcessEnv,
	log?: (entry: LogEntry) => void,
): ServeConfiguration => {
	const capacity = integer(env, "ATLAS_RATE_LIMIT_CAPACITY", 600, 0);
	return {
		port: integer(env, "PORT", 3001, 1, 65535),
		host: env.HOST || "127.0.0.1",
		geometryCacheReleases: integer(
			env,
			"ATLAS_GEOMETRY_CACHE_RELEASES",
			2,
			1,
		),
		shutdownGraceSeconds: integer(
			env,
			"ATLAS_SHUTDOWN_GRACE_SECONDS",
			10,
			0,
		),
		...(env.ATLAS_TERRAIN_REMOTE_ENDPOINT
			? { terrainRemoteEndpoint: env.ATLAS_TERRAIN_REMOTE_ENDPOINT }
			: {}),
		...(env.ATLAS_TERRAIN_COVERAGE_ENDPOINT
			? { terrainCoverageEndpoint: env.ATLAS_TERRAIN_COVERAGE_ENDPOINT }
			: {}),
		terrainRemoteTimeoutMs: integer(
			env,
			"ATLAS_TERRAIN_REMOTE_TIMEOUT_MS",
			5000,
			1,
		),
		terrainRemoteConcurrency: integer(
			env,
			"ATLAS_TERRAIN_REMOTE_CONCURRENCY",
			4,
			1,
		),
		server: {
			...(capacity > 0
				? {
						rateLimit: {
							capacity,
							refillPerSecond: positive(
								env,
								"ATLAS_RATE_LIMIT_REFILL_PER_SECOND",
								10,
							),
							trustedProxyHops: integer(
								env,
								"ATLAS_TRUSTED_PROXY_HOPS",
								0,
								0,
							),
						},
					}
				: {}),
			...(log ? { log } : {}),
			accessLog: toggle(env, "ATLAS_ACCESS_LOG", true),
			...(env.ATLAS_METRICS_TOKEN
				? { metricsToken: env.ATLAS_METRICS_TOKEN }
				: {}),
			maxUrlLength: integer(
				env,
				"ATLAS_MAX_URL_LENGTH",
				DEFAULT_MAX_URL_LENGTH,
				256,
			),
		},
	};
};

/** A log sink writing one JSON object per line, with a timestamp. */
export const jsonLog =
	(write: (line: string) => void = (line) => process.stdout.write(line)) =>
	(entry: LogEntry) =>
		write(
			`${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`,
		);

/** An exception as fields a log search can match on. */
export const errorFields = (error: unknown) =>
	error instanceof Error
		? { name: error.name, message: error.message, stack: error.stack }
		: { name: "NonError", message: String(error) };
