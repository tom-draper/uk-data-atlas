import { DEFAULT_OBSERVATION_CACHE_BYTES } from "@uk-data-atlas/atlas-runtime/catalogue";
import { DEFAULT_CROSSWALK_CACHE_BYTES } from "@uk-data-atlas/atlas-runtime/relationships";
import type { RateLimitPolicy } from "./rateLimit";

/** One structured log line. Written as JSON, one object per line. */
export type LogEntry = {
	level: "info" | "warn" | "error";
	event: string;
	[field: string]: unknown;
};

export const DEFAULT_MAX_CONCURRENT_REQUESTS = 16;
export const DEFAULT_MAX_QUEUED_REQUESTS = 256;
export const DEFAULT_QUEUE_TIMEOUT_MS = 1000;

export type ServerOptions = {
	/** Active requests per worker, including body reads and response writes. */
	maxConcurrentRequests?: number;
	/**
	 * Requests that wait, unread, for an active slot once every slot is taken.
	 * `0` refuses them at once.
	 */
	maxQueuedRequests?: number;
	/** How long a queued request waits for a slot before it is refused. */
	queueTimeoutMs?: number;
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
	/**
	 * Who may read `/metrics`: whoever sends this `Authorization: Bearer`
	 * token, or anyone when `"open"`. Absent, no one: it answers 404, as a
	 * path that is not there, so a public instance does not publish its
	 * traffic by default.
	 */
	metrics?: { token: string } | "open";
	collectMetrics?: () => Promise<string | null>;
	/**
	 * Where to keep daily usage counts, and how often to write them. Absent,
	 * counts live only in `/metrics`. Holds route, outcome and catalogue ids
	 * only, never anything that identifies a caller or what they typed.
	 */
	usage?: {
		directory: string;
		flushIntervalMs: number;
		/** Days of counts kept; older days are deleted when a worker starts. */
		retentionDays: number;
	};
	/** Longest request target served; a longer one is refused with 414. */
	maxUrlLength?: number;
	/**
	 * Bytes of finished answers kept to serve repeat requests without running
	 * their handlers. Absent or `0`, nothing is kept.
	 */
	responseCacheBytes?: number;
};

export const DEFAULT_MAX_URL_LENGTH = 4096;
/**
 * A postcode is placed in three geographies by default, so fewer than three
 * releases would reload one of them on every lookup. The default holds those
 * three, the country release any lookup outside a release's coverage needs,
 * and two more for releases a caller asks for by name: with fewer, each of
 * those lookups evicted a release another would shortly need, and a mix of
 * requests across releases spent most of its time reloading them.
 */
const MINIMUM_GEOMETRY_CACHE_RELEASES = 3;
const DEFAULT_GEOMETRY_CACHE_RELEASES = 6;
const DEFAULT_RESPONSE_CACHE_MEGABYTES = 32;

export type ServeConfiguration = {
	workers: number;
	mapAssetBaseUrl?: string;
	mapTileBaseUrl?: string;
	port: number;
	host: string;
	geometryCacheReleases: number;
	crosswalkCacheBytes: number;
	observationCacheBytes: number;
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

const httpBaseUrl = (env: NodeJS.ProcessEnv, name: string) => {
	const text = env[name];
	if (!text) return undefined;
	const url = new URL(text);
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	)
		throw new Error(
			`${name} must be an HTTP URL without credentials, query or fragment.`,
		);
	return url.href.replace(/\/$/, "");
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
		workers: integer(env, "ATLAS_WORKERS", 2, 1, 32),
		mapAssetBaseUrl: httpBaseUrl(env, "ATLAS_MAP_ASSET_BASE_URL"),
		mapTileBaseUrl: httpBaseUrl(env, "ATLAS_MAP_TILE_BASE_URL"),
		port: integer(env, "PORT", 3001, 1, 65535),
		host: env.HOST || "127.0.0.1",
		geometryCacheReleases: integer(
			env,
			"ATLAS_GEOMETRY_CACHE_RELEASES",
			DEFAULT_GEOMETRY_CACHE_RELEASES,
			MINIMUM_GEOMETRY_CACHE_RELEASES,
		),
		crosswalkCacheBytes:
			integer(
				env,
				"ATLAS_CROSSWALK_CACHE_MB",
				DEFAULT_CROSSWALK_CACHE_BYTES / 1024 / 1024,
				0,
				4096,
			) *
			1024 *
			1024,
		observationCacheBytes:
			integer(
				env,
				"ATLAS_OBSERVATION_CACHE_MB",
				DEFAULT_OBSERVATION_CACHE_BYTES / 1024 / 1024,
				0,
				4096,
			) *
			1024 *
			1024,
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
			maxConcurrentRequests: integer(
				env,
				"ATLAS_MAX_CONCURRENT_REQUESTS",
				DEFAULT_MAX_CONCURRENT_REQUESTS,
				1,
				1024,
			),
			maxQueuedRequests: integer(
				env,
				"ATLAS_MAX_QUEUED_REQUESTS",
				DEFAULT_MAX_QUEUED_REQUESTS,
				0,
				4096,
			),
			queueTimeoutMs: integer(
				env,
				"ATLAS_QUEUE_TIMEOUT_MS",
				DEFAULT_QUEUE_TIMEOUT_MS,
				1,
				30_000,
			),
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
				? { metrics: { token: env.ATLAS_METRICS_TOKEN } }
				: toggle(env, "ATLAS_METRICS_OPEN", false)
					? { metrics: "open" as const }
					: {}),
			...(env.ATLAS_USAGE_DIR
				? {
						usage: {
							directory: env.ATLAS_USAGE_DIR,
							flushIntervalMs:
								integer(
									env,
									"ATLAS_USAGE_FLUSH_SECONDS",
									60,
									1,
									3600,
								) * 1000,
							retentionDays: integer(
								env,
								"ATLAS_USAGE_RETENTION_DAYS",
								400,
								1,
								3650,
							),
						},
					}
				: {}),
			maxUrlLength: integer(
				env,
				"ATLAS_MAX_URL_LENGTH",
				DEFAULT_MAX_URL_LENGTH,
				256,
			),
			responseCacheBytes:
				integer(
					env,
					"ATLAS_RESPONSE_CACHE_MB",
					DEFAULT_RESPONSE_CACHE_MEGABYTES,
					0,
					4096,
				) *
				1024 *
				1024,
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
