import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { Agent, createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { before, after, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";

const directory = mkdtempSync(join(tmpdir(), "atlas-cluster-metrics-"));
const executable = join(directory, "serve.mjs");

before(async () => {
	const data = join(directory, "data/build");
	mkdirSync(data, { recursive: true });
	const canonicalPath = join(data, "atlas.sqlite");
	const canonical = new DatabaseSync(canonicalPath);
	canonical.exec(
		"CREATE TABLE datasets (output TEXT, sha256 TEXT, payloadId TEXT)",
	);
	canonical.close();
	const hash = `sha256:${createHash("sha256").update(readFileSync(canonicalPath)).digest("hex")}`;
	const cache = new DatabaseSync(join(data, "atlas-cache.sqlite"));
	cache.exec(
		"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE dataset_payloads (output TEXT, sha256 TEXT)",
	);
	cache
		.prepare("INSERT INTO meta VALUES (?, ?)")
		.run("atlas-sqlite-content-hash", hash);
	cache.close();
	await build({
		entryPoints: [new URL("../scripts/serve.ts", import.meta.url).pathname],
		outfile: executable,
		bundle: true,
		platform: "node",
		target: "node24",
		format: "esm",
		banner: {
			js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
		},
		plugins: [
			{
				name: "synthetic-catalogues",
				setup(build) {
					build.onResolve({ filter: /^\.\.\/src\/server$/ }, () => ({
						path: resolve(
							import.meta.dirname,
							"fixtures/metricsCatalogues.ts",
						),
					}));
				},
			},
		],
	});
});

after(() => rmSync(directory, { recursive: true, force: true }));

const waitFor = async (condition: () => boolean, diagnostic: () => string) => {
	const deadline = Date.now() + 15_000;
	while (!condition()) {
		assert.ok(Date.now() < deadline, diagnostic());
		await delay(20);
	}
};

const launch = async (t: TestContext, overrides: NodeJS.ProcessEnv = {}) => {
	const reservation = createServer();
	reservation.listen(0, "127.0.0.1");
	await once(reservation, "listening");
	const address = reservation.address();
	assert.ok(address && typeof address !== "string");
	const { port } = address;
	await new Promise<void>((done) => reservation.close(() => done()));
	const child = spawn(process.execPath, [executable], {
		env: {
			...process.env,
			ATLAS_WORKERS: undefined,
			ATLAS_METRICS_TOKEN: "secret",
			ATLAS_METRICS_OPEN: "off",
			ATLAS_ACCESS_LOG: "off",
			ATLAS_API_ROOT: join(directory, "services/api"),
			ATLAS_SHUTDOWN_GRACE_SECONDS: "1",
			PORT: String(port),
			HOST: "127.0.0.1",
			...overrides,
		},
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
	});
	let output = "";
	child.stdout.on("data", (chunk) => (output += String(chunk)));
	child.stderr.on("data", (chunk) => (output += String(chunk)));
	t.after(async () => {
		if (child.exitCode === null && child.signalCode === null) {
			const exited = once(child, "exit");
			if (child.pid) process.kill(-child.pid, "SIGKILL");
			await exited;
		}
	});
	const count = Number(overrides.ATLAS_WORKERS ?? 2);
	await waitFor(
		() =>
			(output.match(/"event":"server.listening"/g)?.length ?? 0) >= count,
		() => output,
	);
	const get = (
		path = "/metrics",
		{
			agent,
			token = "secret",
			method = "GET",
		}: {
			agent?: Agent;
			token?: string;
			method?: string;
		} = {},
	) =>
		new Promise<{
			status: number | undefined;
			headers: import("node:http").IncomingHttpHeaders;
			body: string;
		}>((resolve, reject) => {
			const req = request(
				{
					host: "127.0.0.1",
					port,
					path,
					method,
					agent: agent ?? false,
					headers: { authorization: `Bearer ${token}` },
				},
				(response) => {
					let body = "";
					response.setEncoding("utf8");
					response.on("data", (chunk) => (body += String(chunk)));
					response.on("error", reject);
					response.on("end", () =>
						resolve({
							status: response.statusCode,
							headers: response.headers,
							body,
						}),
					);
				},
			);
			req.setTimeout(5000, () =>
				req.destroy(new Error("HTTP request timed out")),
			);
			req.on("error", reject);
			req.end();
		});
	return { get, pid: child.pid };
};

const workersIn = (text: string) =>
	[...text.matchAll(/^atlas_api_release_info\{worker="(\d+)"/gm)].map(
		(match) => Number(match[1]),
	);

test(
	"the default launcher exposes every worker with correct metric semantics",
	{ timeout: 30_000 },
	async (t) => {
		const { get } = await launch(t);
		const baseline = await get();
		assert.equal(baseline.status, 200);
		assert.deepEqual(workersIn(baseline.body), [1, 2]);
		assert.equal(baseline.headers["cache-control"], "no-store");
		assert.match(String(baseline.headers["content-type"]), /version=0.0.4/);
		assert.equal(
			Number(baseline.headers["content-length"]),
			Buffer.byteLength(baseline.body),
		);
		for (const worker of [1, 2]) {
			const labels = `worker="${worker}",route="/fixture"`;
			assert.ok(
				baseline.body.includes(
					`atlas_api_requests_total{${labels},method="GET",status="200"} ${worker}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_response_bytes_total{${labels}} ${worker * worker * 10}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_count{${labels}} ${worker}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_sum{${labels}} ${(worker * worker) / 100}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_bucket{${labels},le="0.005"} 0\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_bucket{${labels},le="0.01"} ${worker === 1 ? 1 : 0}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_bucket{${labels},le="0.025"} ${worker}\n`,
				),
			);
			assert.ok(
				baseline.body.includes(
					`atlas_api_request_duration_seconds_bucket{${labels},le="+Inf"} ${worker}\n`,
				),
			);
			assert.match(
				baseline.body,
				new RegExp(
					`^atlas_api_process_memory_bytes\\{worker="${worker}",kind="rss"\\} [1-9]\\d*$`,
					"m",
				),
			);
			assert.match(
				baseline.body,
				new RegExp(
					`^atlas_api_release_info\\{worker="${worker}",.*\\} 1$`,
					"m",
				),
			);
		}
		const metadata = baseline.body
			.split("\n")
			.filter((line) => line.startsWith("#"));
		assert.equal(new Set(metadata).size, metadata.length);
		for (const line of baseline.body.trimEnd().split("\n"))
			if (!line.startsWith("#"))
				assert.match(line, /^[^{]+\{worker="[12]"[,}]/);

		await Promise.all(Array.from({ length: 12 }, () => get("/healthz")));
		const scrapes = await Promise.all(
			Array.from({ length: 8 }, () => get()),
		);
		for (const scrape of scrapes) {
			assert.equal(scrape.status, 200);
			assert.deepEqual(workersIn(scrape.body), [1, 2]);
			const counts = [
				...scrape.body.matchAll(
					/^atlas_api_requests_total\{worker="[12]",route="\/healthz",method="GET",status="200"\} (\d+)$/gm,
				),
			];
			assert.equal(counts.length, 2);
			assert.equal(
				counts.reduce((sum, match) => sum + Number(match[1]), 0),
				12,
			);
		}
		for (const token of ["", "wrong"]) {
			const denied = await get("/metrics", { token });
			assert.equal(denied.status, 401);
			assert.equal(denied.headers["cache-control"], "no-store");
			assert.equal(
				denied.headers["www-authenticate"],
				'Bearer realm="metrics"',
			);
		}
		const head = await get("/metrics", { method: "HEAD" });
		assert.equal(head.status, 200);
		assert.equal(head.body, "");
		assert.equal(head.headers["cache-control"], "no-store");
	},
);

test(
	"collection times out, recovers, and follows worker loss and replacement",
	{ timeout: 30_000 },
	async (t) => {
		const { get, pid: primaryPid } = await launch(t);
		assert.ok(primaryPid);
		const agent = new Agent({ keepAlive: true, maxSockets: 1 });
		t.after(() => agent.destroy());
		const connection = await get("/healthz", { agent });
		const survivor = Number(connection.headers["x-fixture-worker"]);
		let victim: Awaited<ReturnType<typeof get>> | undefined;
		for (let attempt = 0; attempt < 20; attempt++) {
			const response = await get("/healthz");
			if (Number(response.headers["x-fixture-worker"]) !== survivor) {
				victim = response;
				break;
			}
		}
		assert.ok(victim);
		const pid = Number(victim.headers["x-fixture-pid"]);
		const lost = Number(victim.headers["x-fixture-worker"]);
		process.kill(pid, "SIGSTOP");
		t.after(() => {
			try {
				process.kill(pid, "SIGCONT");
			} catch {}
		});
		const started = performance.now();
		const unavailable = await get("/metrics", { agent });
		assert.equal(unavailable.status, 503);
		assert.equal(unavailable.headers["cache-control"], "no-store");
		assert.deepEqual(JSON.parse(unavailable.body), {
			status: "metrics-unavailable",
		});
		assert.ok(performance.now() - started < 3000);
		assert.equal(
			(await get("/metrics", { agent, token: "wrong" })).status,
			401,
		);
		process.kill(pid, "SIGCONT");
		assert.equal((await get("/metrics", { agent })).status, 200);
		process.kill(primaryPid, "SIGSTOP");
		const noPrimary = await get("/metrics", { agent });
		assert.equal(noPrimary.status, 503);
		assert.equal(noPrimary.headers["cache-control"], "no-store");
		process.kill(primaryPid, "SIGCONT");
		assert.equal((await get("/metrics", { agent })).status, 200);
		process.kill(pid, "SIGSTOP");
		const interrupted = get("/metrics", { agent });
		await delay(100);
		process.kill(pid, "SIGKILL");
		assert.equal((await interrupted).status, 503);
		let replacement: Awaited<ReturnType<typeof get>> | undefined;
		const deadline = Date.now() + 15_000;
		while (Date.now() < deadline) {
			const scrape = await get("/metrics", { agent });
			if (scrape.status === 200) {
				const workers = workersIn(scrape.body);
				assert.ok(!workers.includes(lost));
				if (workers.length === 2) {
					replacement = scrape;
					break;
				}
				assert.deepEqual(workers, [survivor]);
			}
			await delay(50);
		}
		assert.ok(replacement);
		assert.deepEqual(workersIn(replacement.body), [survivor, 3].sort());
		assert.ok(!replacement.body.includes(`worker="${lost}"`));
	},
);

test(
	"open, disabled, and single-worker deployments retain their scrape policy",
	{ timeout: 30_000 },
	async (t) => {
		const open = await launch(t, {
			ATLAS_METRICS_TOKEN: "",
			ATLAS_METRICS_OPEN: "on",
		});
		const scrape = await open.get("/metrics", { token: "" });
		assert.equal(scrape.status, 200);
		assert.deepEqual(workersIn(scrape.body), [1, 2]);
		const closed = await launch(t, {
			ATLAS_METRICS_TOKEN: "",
			ATLAS_METRICS_OPEN: "off",
		});
		assert.equal((await closed.get()).status, 404);
		const single = await launch(t, { ATLAS_WORKERS: "1" });
		const local = await single.get();
		assert.equal(local.status, 200);
		assert.match(local.body, /^atlas_api_release_info\{release=/m);
		assert.doesNotMatch(local.body, /worker=/);
	},
);
