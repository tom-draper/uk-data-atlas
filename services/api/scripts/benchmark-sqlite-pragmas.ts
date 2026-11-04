import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-runtime/storage";

// Compares the connection pragmas of the shared read-only module on the real
// databases, one process per configuration, read only.
//
// From services/api:
//   node --import tsx scripts/benchmark-sqlite-pragmas.ts \
//     --atlas ../../data/build/atlas.sqlite \
//     --cache ../../data/build/atlas-cache.sqlite \
//     [--only baseline,mmap-256m] [--phases postcode,area] [--rounds 3] [--plan plan.json] [--out results.json]
//
// Before each configuration the parent asks the kernel to drop the files'
// clean pages with `dd iflag=nocache count=0` (posix_fadvise DONTNEED), which
// needs no root. The cold pass is the first run in a fresh process after that.
// The warm pass repeats the same work. Run one at a time on a quiet machine.

type Config = {
	name: string;
	queryOnly: 0 | 1;
	tempStore: "default" | "memory";
	cacheKiB: number;
	mmapBytes: number;
};

const MIB = 1024 * 1024;
const base = {
	queryOnly: 0,
	tempStore: "default",
	cacheKiB: 2000,
	mmapBytes: 0,
} as const;
const configs: Config[] = [
	{ name: "baseline", ...base },
	{ name: "query_only", ...base, queryOnly: 1 },
	{ name: "temp_store", ...base, tempStore: "memory" },
	{ name: "cache-32m", ...base, cacheKiB: 32 * 1024 },
	{ name: "cache-128m", ...base, cacheKiB: 128 * 1024 },
	{ name: "mmap-256m", ...base, mmapBytes: 256 * MIB },
	{ name: "mmap-2g", ...base, mmapBytes: 2048 * MIB - 65536 },
	{
		name: "combo-a",
		queryOnly: 1,
		tempStore: "memory",
		cacheKiB: 32 * 1024,
		mmapBytes: 256 * MIB,
	},
	{
		name: "combo-b",
		queryOnly: 1,
		tempStore: "memory",
		cacheKiB: 16 * 1024,
		mmapBytes: 2048 * MIB - 65536,
	},
];

type Plan = {
	districts: { district: string; postcodes: number }[];
	areas: { code: string; areaId: number; releaseId: number }[];
	series: { id: number; rows: number; dataset: string }[];
	filter: { dataset: string; areaCode: string };
	payloadIds: string[];
};

type Samples = Record<string, { cold: number[]; warm: number[] }>;
type Memory = {
	rssMiB: number;
	anonMiB: number;
	fileMiB: number;
	/** Page faults since the process started. */
	minorFaults: number;
	majorFaults: number;
};
type Result = {
	config: Config;
	samples: Samples;
	memory: Record<"open" | "cold" | "warm", Memory> & { peakMiB: number };
};

const argument = (name: string) => {
	const index = process.argv.indexOf(`--${name}`);
	return index < 0 ? undefined : process.argv[index + 1];
};

/** A small seeded generator, so every configuration reads the same keys. */
const random = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const sample = <T>(items: readonly T[], count: number, seed: number) => {
	const next = random(seed);
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const other = Math.floor(next() * (index + 1));
		[copy[index], copy[other]] = [copy[other]!, copy[index]!];
	}
	return copy.slice(0, count);
};

const percentile = (values: number[], fraction: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[
		Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
	]!;
};

const memory = (): Memory => {
	const status = readFileSync("/proc/self/status", "utf8");
	const kib = (key: string) =>
		Number(
			new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(status)?.[1] ?? 0,
		) / 1024;
	// Fields 10 and 12 of /proc/self/stat, counted after the command name.
	const raw = readFileSync("/proc/self/stat", "utf8");
	const stat = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
	return {
		rssMiB: kib("VmRSS"),
		anonMiB: kib("RssAnon"),
		fileMiB: kib("RssFile"),
		minorFaults: Number(stat[7]),
		majorFaults: Number(stat[9]),
	};
};

// The queries match the readers: postcode districts, areas, one series of
// observations (atlasStatisticsObservations), the cache's payload table.
const postcodeSql =
	"SELECT postcode, easting, northing, quality, country, introduced, terminated, largeUser FROM postcodes WHERE postcode >= ? AND postcode < ? AND length(postcode) = ? ORDER BY postcode";
const areaSql = "SELECT id, geography_id FROM area WHERE code = ?";
const areaNameSql =
	"SELECT name, area_m2, population FROM area_version WHERE release_id = ? AND area_id = ?";
const seriesSql =
	"SELECT a.code, p.label AS period, o.value, o.lower, o.upper, st.slug AS status FROM observation o JOIN area_version v ON v.id = o.area_version_id JOIN area a ON a.id = v.area_id JOIN period p ON p.id = o.period_id JOIN status st ON st.id = o.status_id WHERE o.series_id = ?";
const aggregateSql =
	"SELECT count(*) AS n, sum(value) AS total FROM observation";
const filterSql =
	"SELECT dataset, measure, area_code, period, value FROM v_observation WHERE dataset = ? AND area_code = ?";
const payloadSql = "SELECT payload FROM payloads WHERE id = ?";

function buildPlan(atlas: string, cache: string): Plan {
	const database = new DatabaseSync(atlas, { readOnly: true });
	const districts: Plan["districts"] = [];
	let from = "";
	for (;;) {
		const first = database
			.prepare(
				"SELECT postcode FROM postcodes WHERE postcode > ? ORDER BY postcode LIMIT 1",
			)
			.get(from) as { postcode: string } | undefined;
		if (!first) break;
		const district = first.postcode.slice(0, -3);
		const last = database
			.prepare(
				"SELECT max(postcode) AS last, count(*) AS n FROM postcodes WHERE postcode >= ? AND postcode < ? AND length(postcode) = ?",
			)
			.get(district, `${district}\x7f`, district.length + 3) as {
			last: string;
			n: number;
		};
		districts.push({ district, postcodes: Number(last.n) });
		from = last.last;
	}
	const areas = (
		database
			.prepare(
				"SELECT a.code, v.area_id AS areaId, v.release_id AS releaseId FROM area_version v JOIN area a ON a.id = v.area_id",
			)
			.all() as Plan["areas"]
	).map((row) => ({
		code: row.code,
		areaId: Number(row.areaId),
		releaseId: Number(row.releaseId),
	}));
	const sizes = database
		.prepare(
			"SELECT s.id, d.slug AS dataset, count(*) AS rows FROM observation o JOIN series s ON s.id = o.series_id JOIN dataset d ON d.id = s.dataset_id GROUP BY s.id",
		)
		.all() as { id: number; dataset: string; rows: number }[];
	// Three series from different datasets, at the median, p90 and p99 size.
	const bySize = sizes.sort((a, b) => a.rows - b.rows);
	const series: Plan["series"] = [];
	for (const fraction of [0.5, 0.9, 0.99]) {
		let index = Math.floor(bySize.length * fraction);
		while (
			series.some((chosen) => chosen.dataset === bySize[index]!.dataset)
		)
			index -= 1;
		const chosen = bySize[index]!;
		series.push({
			id: Number(chosen.id),
			dataset: chosen.dataset,
			rows: Number(chosen.rows),
		});
	}
	const filterSeries = series[1]!;
	const filterArea = database
		.prepare(
			"SELECT a.code FROM observation o JOIN area_version v ON v.id = o.area_version_id JOIN area a ON a.id = v.area_id WHERE o.series_id = ? LIMIT 1",
		)
		.get(filterSeries.id) as { code: string };
	database.close();
	const cacheDatabase = new DatabaseSync(cache, { readOnly: true });
	const payloadIds = (
		cacheDatabase.prepare("SELECT id FROM payloads").all() as {
			id: string;
		}[]
	).map((row) => String(row.id));
	cacheDatabase.close();
	return {
		districts: sample(districts, 1000, 1),
		areas: sample(areas, 1000, 2),
		series,
		filter: { dataset: filterSeries.dataset, areaCode: filterArea.code },
		payloadIds: sample(payloadIds, 300, 3),
	};
}

function runChild(
	atlas: string,
	cache: string,
	plan: Plan,
	config: Config,
): Result {
	const samples: Samples = {};
	const record = (name: string, pass: "cold" | "warm", ms: number) => {
		(samples[name] ??= { cold: [], warm: [] })[pass].push(ms);
	};
	const phases = argument("phases")?.split(",");
	const timed = (
		name: string,
		pass: "cold" | "warm",
		path: string,
		run: (
			prepare: (
				sql: string,
			) => ReturnType<ReturnType<typeof openReadOnlyDatabase>["prepare"]>,
		) => unknown,
	) => {
		if (phases && !phases.some((phase) => name.startsWith(phase))) return;
		const database = openReadOnlyDatabase(path);
		try {
			const started = performance.now();
			run((sql) => database.prepare(sql));
			record(name, pass, performance.now() - started);
		} finally {
			database.release();
		}
	};
	const open = (path: string) => openReadOnlyDatabase(path).release();
	open(atlas);
	open(cache);
	const opened = memory();
	const pass = (which: "cold" | "warm", repeats: number) => {
		const order =
			which === "cold"
				? plan.districts
				: sample(plan.districts, 1000, 11);
		for (const { district } of order)
			timed("postcode shard", which, atlas, (prepare) =>
				prepare(postcodeSql).all(
					district,
					`${district}\x7f`,
					district.length + 3,
				),
			);
		for (const area of which === "cold"
			? plan.areas
			: sample(plan.areas, 1000, 12))
			timed("area lookup", which, atlas, (prepare) => {
				prepare(areaSql).get(area.code);
				prepare(areaNameSql).get(area.releaseId, area.areaId);
			});
		for (let index = 0; index < repeats; index += 1)
			for (const { id } of plan.series)
				timed("observation series", which, atlas, (prepare) =>
					prepare(seriesSql).all(id),
				);
		for (let index = 0; index < repeats; index += 1)
			timed("observation aggregate", which, atlas, (prepare) =>
				prepare(aggregateSql).get(),
			);
		for (let index = 0; index < repeats; index += 1)
			timed("v_observation filter", which, atlas, (prepare) =>
				prepare(filterSql).all(
					plan.filter.dataset,
					plan.filter.areaCode,
				),
			);
		for (const id of which === "cold"
			? plan.payloadIds
			: sample(plan.payloadIds, 300, 13))
			timed("cache payload", which, cache, (prepare) =>
				prepare(payloadSql).get(id),
			);
	};
	pass("cold", 1);
	const cold = memory();
	pass("warm", 5);
	const warm = memory();
	const peak =
		Number(
			/^VmHWM:\s+(\d+) kB/m.exec(
				readFileSync("/proc/self/status", "utf8"),
			)?.[1],
		) / 1024;
	return {
		config,
		samples,
		memory: { open: opened, cold, warm, peakMiB: peak },
	};
}

function main() {
	const atlas = argument("atlas");
	const cache = argument("cache");
	if (!atlas || !cache) throw new Error("Pass --atlas and --cache");
	if (process.argv.includes("--child")) {
		const input = JSON.parse(readFileSync(argument("input")!, "utf8")) as {
			plan: Plan;
			config: Config;
		};
		process.stdout.write(
			JSON.stringify(runChild(atlas, cache, input.plan, input.config)),
		);
		return;
	}
	const only = argument("only")?.split(",");
	// The plan is kept so repeated runs read the same keys without a re-scan.
	const planFile = argument("plan");
	const plan: Plan =
		planFile && existsSync(planFile)
			? JSON.parse(readFileSync(planFile, "utf8"))
			: buildPlan(atlas, cache);
	if (planFile && !existsSync(planFile))
		writeFileSync(planFile, JSON.stringify(plan));
	console.error(
		`${plan.districts.length} districts sampled, series ${plan.series.map((s) => `${s.dataset}:${s.rows}`).join(", ")}`,
	);
	const results: Result[] = [];
	const rounds = Number(argument("rounds") ?? 1);
	const chosen = configs.filter((c) => !only || only.includes(c.name));
	for (const config of Array.from({ length: rounds }, () => chosen).flat()) {
		// Ask the kernel to drop clean pages of both files, then start fresh.
		for (const file of [atlas, cache])
			spawnSync("dd", [
				`if=${file}`,
				"iflag=nocache",
				"count=0",
				"status=none",
			]);
		const input = `${argument("out") ?? "bench"}.input.json`;
		writeFileSync(input, JSON.stringify({ plan, config }));
		const child = spawnSync(
			process.execPath,
			[
				"--import",
				"tsx",
				fileURLToPath(import.meta.url),
				"--child",
				"--atlas",
				atlas,
				"--cache",
				cache,
				"--input",
				input,
				...(argument("phases")
					? ["--phases", argument("phases")!]
					: []),
			],
			{
				encoding: "utf8",
				maxBuffer: 64 * MIB,
				env: {
					...process.env,
					ATLAS_SQLITE_QUERY_ONLY: String(config.queryOnly),
					ATLAS_SQLITE_TEMP_STORE: config.tempStore,
					ATLAS_SQLITE_CACHE_KIB: String(config.cacheKiB),
					ATLAS_SQLITE_MMAP_BYTES: String(config.mmapBytes),
				},
			},
		);
		if (child.status !== 0) throw new Error(child.stderr);
		const result = JSON.parse(child.stdout) as Result;
		// Rounds interleave the configurations; samples pool per configuration.
		const earlier = results.find((r) => r.config.name === config.name);
		if (earlier) {
			for (const [name, pooled] of Object.entries(result.samples)) {
				earlier.samples[name]!.cold.push(...pooled.cold);
				earlier.samples[name]!.warm.push(...pooled.warm);
			}
			earlier.memory = result.memory;
		} else results.push(result);
		console.error(`${config.name} done`);
	}
	const out = argument("out");
	if (out) writeFileSync(out, JSON.stringify({ plan, results }));
	const f = (value: number) => value.toFixed(value < 10 ? 2 : 1);
	const names = Object.keys(results[0]!.samples);
	for (const pass of ["cold", "warm"] as const) {
		console.log(`\n${pass} p50 / p95 (ms)\n`);
		console.log(`| config | ${names.join(" | ")} |`);
		console.log(`|${"---|".repeat(names.length + 1)}`);
		for (const { config, samples } of results)
			console.log(
				`| ${config.name} | ${names
					.map((name) => {
						const values = samples[name]![pass];
						return `${f(percentile(values, 0.5))} / ${f(percentile(values, 0.95))}`;
					})
					.join(" | ")} |`,
			);
	}
	console.log(
		"\nmemory (MiB) and page faults, last round\n\n| config | open rss | cold rss | warm rss | warm anon | warm file | peak | minor faults | major faults |\n|---|---|---|---|---|---|---|---|---|",
	);
	for (const { config, memory: m } of results)
		console.log(
			`| ${config.name} | ${f(m.open.rssMiB)} | ${f(m.cold.rssMiB)} | ${f(m.warm.rssMiB)} | ${f(m.warm.anonMiB)} | ${f(m.warm.fileMiB)} | ${f(m.peakMiB)} | ${m.warm.minorFaults} | ${m.warm.majorFaults} |`,
		);
}

main();
