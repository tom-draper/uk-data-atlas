import { monitorEventLoopDelay } from "node:perf_hooks";
import type { AreaGeometryCacheStats } from "./areaGeometry";

/**
 * Operational metrics in the Prometheus text exposition format.
 *
 * Every request is labelled by the operation template it reached, never by its
 * concrete path, so the number of series is bounded by the contract rather
 * than by traffic. Route handlers run synchronously, so a slow request blocks
 * every other: event loop delay is exported for that reason, and is usually
 * the first sign that a geometry release is being loaded.
 */
const DURATION_BUCKETS = [
	0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

type Labels = Record<string, string>;

const escapeLabel = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const labelText = (labels: Labels) => {
	const entries = Object.entries(labels);
	return entries.length === 0
		? ""
		: `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(",")}}`;
};

const seriesKey = (labels: Labels) => JSON.stringify(labels);

class Counter {
	private readonly series = new Map<
		string,
		{ labels: Labels; value: number }
	>();
	constructor(
		readonly name: string,
		readonly help: string,
	) {}
	inc(labels: Labels = {}, by = 1) {
		const key = seriesKey(labels);
		const entry = this.series.get(key) ?? { labels, value: 0 };
		entry.value += by;
		this.series.set(key, entry);
	}
	value(labels: Labels = {}) {
		return this.series.get(seriesKey(labels))?.value ?? 0;
	}
	render() {
		return [
			`# HELP ${this.name} ${this.help}`,
			`# TYPE ${this.name} counter`,
			...[...this.series.values()].map(
				({ labels, value }) =>
					`${this.name}${labelText(labels)} ${value}`,
			),
		];
	}
}

class Histogram {
	private readonly series = new Map<
		string,
		{ labels: Labels; buckets: number[]; sum: number; count: number }
	>();
	constructor(
		readonly name: string,
		readonly help: string,
	) {}
	observe(labels: Labels, value: number) {
		const key = seriesKey(labels);
		const entry = this.series.get(key) ?? {
			labels,
			buckets: DURATION_BUCKETS.map(() => 0),
			sum: 0,
			count: 0,
		};
		DURATION_BUCKETS.forEach((bound, index) => {
			if (value <= bound) entry.buckets[index]! += 1;
		});
		entry.sum += value;
		entry.count += 1;
		this.series.set(key, entry);
	}
	render() {
		return [
			`# HELP ${this.name} ${this.help}`,
			`# TYPE ${this.name} histogram`,
			...[...this.series.values()].flatMap(
				({ labels, buckets, sum, count }) => [
					...DURATION_BUCKETS.map(
						(bound, index) =>
							`${this.name}_bucket${labelText({ ...labels, le: String(bound) })} ${buckets[index]}`,
					),
					`${this.name}_bucket${labelText({ ...labels, le: "+Inf" })} ${count}`,
					`${this.name}_sum${labelText(labels)} ${sum}`,
					`${this.name}_count${labelText(labels)} ${count}`,
				],
			),
		];
	}
}

const sampled = (
	type: "gauge" | "counter",
	name: string,
	help: string,
	samples: Array<[Labels, number]>,
) => [
	`# HELP ${name} ${help}`,
	`# TYPE ${name} ${type}`,
	...samples.map(([labels, value]) => `${name}${labelText(labels)} ${value}`),
];

export type RequestObservation = {
	route: string;
	method: string;
	status: number;
	durationSeconds: number;
	bytes: number;
};

export class ApiMetrics {
	readonly requests = new Counter(
		"atlas_api_requests_total",
		"Requests answered, by operation template, method and status.",
	);
	readonly duration = new Histogram(
		"atlas_api_request_duration_seconds",
		"Time to answer a request, by operation template.",
	);
	readonly responseBytes = new Counter(
		"atlas_api_response_bytes_total",
		"Response body bytes sent, by operation template.",
	);
	readonly rateLimited = new Counter(
		"atlas_api_rate_limited_total",
		"Requests refused with 429 because the client's bucket was empty.",
	);
	readonly failures = new Counter(
		"atlas_api_unhandled_errors_total",
		"Requests that threw and were answered 500, by operation template.",
	);
	private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
	private readonly started = performance.now();

	constructor(
		private readonly atlasRelease: string,
		private readonly geometryCacheStats: () =>
			AreaGeometryCacheStats | undefined = () => undefined,
	) {
		this.eventLoopDelay.enable();
	}

	observe({
		route,
		method,
		status,
		durationSeconds,
		bytes,
	}: RequestObservation) {
		this.requests.inc({ route, method, status: String(status) });
		this.duration.observe({ route }, durationSeconds);
		this.responseBytes.inc({ route }, bytes);
	}

	close() {
		this.eventLoopDelay.disable();
	}

	render(): string {
		const memory = process.memoryUsage();
		const cache = this.geometryCacheStats();
		const delay = (value: number) => value / 1e9;
		return `${[
			...sampled(
				"gauge",
				"atlas_api_release_info",
				"The Atlas release this server answers under.",
				[[{ release: this.atlasRelease, api_version: "v1" }, 1]],
			),
			...sampled(
				"gauge",
				"atlas_api_uptime_seconds",
				"Seconds since the server started.",
				[[{}, (performance.now() - this.started) / 1000]],
			),
			...this.requests.render(),
			...this.duration.render(),
			...this.responseBytes.render(),
			...this.rateLimited.render(),
			...this.failures.render(),
			...sampled(
				"gauge",
				"atlas_api_event_loop_delay_seconds",
				"Event loop delay since the server started. A handler that blocks delays every other request.",
				[
					[
						{ quantile: "0.5" },
						delay(this.eventLoopDelay.percentile(50)),
					],
					[
						{ quantile: "0.99" },
						delay(this.eventLoopDelay.percentile(99)),
					],
					[{ quantile: "1" }, delay(this.eventLoopDelay.max)],
				],
			),
			...sampled(
				"gauge",
				"atlas_api_process_memory_bytes",
				"Process memory by kind.",
				[
					[{ kind: "rss" }, memory.rss],
					[{ kind: "heap_used" }, memory.heapUsed],
					[{ kind: "heap_total" }, memory.heapTotal],
					[{ kind: "external" }, memory.external],
				],
			),
			...(cache
				? [
						...sampled(
							"gauge",
							"atlas_api_geometry_cache_releases",
							"Geometry releases held in memory, and the most the cache may hold.",
							[
								[
									{ kind: "loaded" },
									cache.loadedReleases.length,
								],
								[{ kind: "limit" }, cache.maxReleases],
							],
						),
						...sampled(
							"counter",
							"atlas_api_geometry_cache_events_total",
							"Area reads answered from a loaded release, release loads and evictions since the server started.",
							[
								[{ event: "read" }, cache.reads],
								[{ event: "load" }, cache.loads],
								[{ event: "eviction" }, cache.evictions],
							],
						),
						...sampled(
							"counter",
							"atlas_api_geometry_cache_load_seconds_total",
							"Time spent reading geometry releases into the cache.",
							[[{}, cache.loadSeconds]],
						),
					]
				: []),
		].join("\n")}\n`;
	}
}
