#!/usr/bin/env node
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_URL = "http://localhost:3000/atlas";
const DEFAULT_OUT_DIR = ".profiles/atlas-memory";

// Chrome/Chromium binaries vary by distro and OS. Probe common locations so
// the profiler works without requiring CHROME_PATH or --chrome to be set.
const CHROME_CANDIDATES = [
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/opt/google/chrome/chrome",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
];

function detectChrome() {
	if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
	return CHROME_CANDIDATES.find((path) => existsSync(path)) ?? CHROME_CANDIDATES[0];
}

const DEFAULT_CHROME = detectChrome();

function parseArgs(argv) {
	const args = {
		url: DEFAULT_URL,
		outDir: DEFAULT_OUT_DIR,
		chrome: process.env.CHROME_PATH || DEFAULT_CHROME,
		waitMs: 8000,
		heapSnapshot: false,
		headless: true,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--") continue;
		else if (arg === "--url") args.url = argv[++i];
		else if (arg === "--out-dir") args.outDir = argv[++i];
		else if (arg === "--chrome") args.chrome = argv[++i];
		else if (arg === "--wait-ms") args.waitMs = Number(argv[++i]);
		else if (arg === "--heap-snapshot") args.heapSnapshot = true;
		else if (arg === "--no-heap-snapshot") args.heapSnapshot = false;
		else if (arg === "--headed") args.headless = false;
		else if (arg === "--help") {
			console.log(`Usage: pnpm profile:atlas [options]

Options:
  --url <url>             Atlas URL to profile. Default: ${DEFAULT_URL}
  --out-dir <dir>         Output directory. Default: ${DEFAULT_OUT_DIR}
  --chrome <path>         Chrome/Chromium executable. Default: ${DEFAULT_CHROME}
  --wait-ms <ms>          Extra wait after network idle. Default: 8000
  --heap-snapshot         Also write a full .heapsnapshot (memory-heavy; off by default)
  --no-heap-snapshot      Skip writing the .heapsnapshot file
  --headed                Run Chrome with a visible window`);
			process.exit(0);
		}
	}

	if (!Number.isFinite(args.waitMs) || args.waitMs < 0) {
		throw new Error("--wait-ms must be a non-negative number");
	}
	return args;
}

function delay(ms) {
	return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForJson(url, timeoutMs = 10000) {
	const startedAt = Date.now();
	let lastError;
	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) return await response.json();
			lastError = new Error(`${response.status} ${response.statusText}`);
		} catch (error) {
			lastError = error;
		}
		await delay(100);
	}
	throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}`);
}

class CdpClient {
	constructor(wsUrl) {
		this.wsUrl = wsUrl;
		this.nextId = 1;
		this.pending = new Map();
		this.eventHandlers = new Map();
	}

	async connect() {
		this.ws = new WebSocket(this.wsUrl);
		await new Promise((resolveConnect, rejectConnect) => {
			const timeout = setTimeout(
				() => rejectConnect(new Error("Timed out connecting to Chrome DevTools")),
				10000,
			);
			this.ws.addEventListener("open", () => {
				clearTimeout(timeout);
				resolveConnect();
			}, { once: true });
			this.ws.addEventListener("error", () => {
				clearTimeout(timeout);
				rejectConnect(new Error("Failed to connect to Chrome DevTools"));
			}, { once: true });
		});

		this.ws.addEventListener("message", (event) => {
			const message = JSON.parse(event.data);
			if (message.id) {
				const pending = this.pending.get(message.id);
				if (!pending) return;
				this.pending.delete(message.id);
				if (message.error) pending.reject(new Error(message.error.message));
				else pending.resolve(message.result ?? {});
				return;
			}

			const handlers = this.eventHandlers.get(message.method);
			if (!handlers) return;
			for (const handler of handlers) handler(message.params ?? {});
		});
	}

	send(method, params = {}) {
		const id = this.nextId++;
		this.ws.send(JSON.stringify({ id, method, params }));
		return new Promise((resolveSend, rejectSend) => {
			this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
		});
	}

	on(method, handler) {
		const handlers = this.eventHandlers.get(method) ?? new Set();
		handlers.add(handler);
		this.eventHandlers.set(method, handlers);
	}

	close() {
		this.ws?.close();
	}
}

async function createPageTarget(debugPort, url) {
	const response = await fetch(
		`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`,
		{ method: "PUT" },
	);
	if (!response.ok) {
		throw new Error(`Failed to create Chrome target: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

function sumSampleSizes(sample) {
	let total = 0;
	const byFunction = new Map();
	const byUrl = new Map();

	function visit(node, stack) {
		const frame = node.callFrame ?? {};
		const name = frame.functionName || "(anonymous)";
		const url = frame.url || "(runtime)";
		const nextStack = [...stack, `${name} ${url}:${frame.lineNumber ?? 0}`];
		const selfSize = node.selfSize ?? 0;
		if (selfSize > 0) {
			total += selfSize;
			const key = nextStack.slice(-1)[0];
			byFunction.set(key, (byFunction.get(key) ?? 0) + selfSize);
			byUrl.set(url, (byUrl.get(url) ?? 0) + selfSize);
		}
		for (const child of node.children ?? []) visit(child, nextStack);
	}

	visit(sample.head, []);
	return {
		totalBytes: total,
		topFunctions: [...byFunction.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 40)
			.map(([name, bytes]) => ({ name, bytes })),
		topUrls: [...byUrl.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 40)
			.map(([url, bytes]) => ({ url, bytes })),
	};
}

function bytes(value) {
	return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function metricValue(metrics, name) {
	return metrics.find((metric) => metric.name === name)?.value ?? null;
}

async function waitForNetworkQuiet(networkState, quietMs, timeoutMs) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (networkState.inflight.size === 0 && Date.now() - networkState.lastActivityAt >= quietMs) {
			return;
		}
		await delay(100);
	}
}

function writeMarkdown(report, heapSnapshotPath) {
	const networkRows = report.network.topResponses
		.map((entry) => `| ${bytes(entry.encodedDataLength)} | ${entry.status ?? ""} | ${entry.mimeType ?? ""} | \`${entry.url}\` |`)
		.join("\n");
	const allocationRows = report.heapSampling.topFunctions
		.slice(0, 20)
		.map((entry) => `| ${bytes(entry.bytes)} | \`${entry.name}\` |`)
		.join("\n");
	const urlAllocationRows = report.heapSampling.topUrls
		.slice(0, 20)
		.map((entry) => `| ${bytes(entry.bytes)} | \`${entry.url}\` |`)
		.join("\n");

	return `# Atlas Memory Profile

Generated: ${report.generatedAt}

URL: \`${report.url}\`

## Browser Memory

| Metric | Before GC | After load | After GC |
| --- | ---: | ---: | ---: |
| JS heap used | ${bytes(report.heap.before.usedSize)} | ${bytes(report.heap.afterLoad.usedSize)} | ${bytes(report.heap.afterGc.usedSize)} |
| JS heap total | ${bytes(report.heap.before.totalSize)} | ${bytes(report.heap.afterLoad.totalSize)} | ${bytes(report.heap.afterGc.totalSize)} |

## DOM Counters

| Metric | Count |
| --- | ---: |
| Documents | ${report.domCounters.documents} |
| Nodes | ${report.domCounters.nodes} |
| JS event listeners | ${report.domCounters.jsEventListeners} |

## Performance Metrics

| Metric | Value |
| --- | ---: |
| JS heap used size | ${bytes(report.performance.JSHeapUsedSize ?? 0)} |
| JS heap total size | ${bytes(report.performance.JSHeapTotalSize ?? 0)} |
| Documents | ${report.performance.Documents ?? ""} |
| Nodes | ${report.performance.Nodes ?? ""} |
| Layout count | ${report.performance.LayoutCount ?? ""} |
| Recalc style count | ${report.performance.RecalcStyleCount ?? ""} |

## Network Payloads

Total encoded response bytes observed: ${bytes(report.network.totalEncodedDataLength)}

| Encoded size | Status | MIME | URL |
| ---: | ---: | --- | --- |
${networkRows}

## Heap Allocation Sampling

Sampled allocations total: ${bytes(report.heapSampling.totalBytes)}

### Top Allocation Functions

| Sampled bytes | Function |
| ---: | --- |
${allocationRows}

### Top Allocation URLs

| Sampled bytes | URL |
| ---: | --- |
${urlAllocationRows}

## Files

- JSON report: \`${report.files.reportJson}\`
${heapSnapshotPath ? `- Heap snapshot: \`${heapSnapshotPath}\`` : "- Heap snapshot: skipped"}

Open the heap snapshot in Chrome DevTools Memory panel to inspect retained object trees. The JSON report is intended for AI agents and code review.
`;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const outDir = resolve(args.outDir);
	const debugPort = 9222 + Math.floor(Math.random() * 1000);
	if (!existsSync(args.chrome)) {
		throw new Error(
			`Chrome/Chromium not found at "${args.chrome}". Pass --chrome <path> or set CHROME_PATH.`,
		);
	}
	const userDataDir = await mkdtemp(join(tmpdir(), "atlas-memory-profile-"));
	const chromeArgs = [
		`--remote-debugging-port=${debugPort}`,
		"--remote-debugging-address=127.0.0.1",
		`--user-data-dir=${userDataDir}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-extensions",
		"--disable-dev-shm-usage",
		"--no-sandbox",
		"--js-flags=--expose-gc",
	];
	if (args.headless) chromeArgs.push("--headless=new", "--disable-gpu");

	const chrome = spawn(args.chrome, chromeArgs, {
		stdio: ["ignore", "ignore", "pipe"],
	});

	let stderr = "";
	chrome.stderr.on("data", (chunk) => {
		stderr += chunk.toString();
	});

	try {
		await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
		const target = await createPageTarget(debugPort, "about:blank");
		const cdp = new CdpClient(target.webSocketDebuggerUrl);
		await cdp.connect();

		const networkState = {
			inflight: new Set(),
			lastActivityAt: Date.now(),
			responses: new Map(),
		};

		cdp.on("Network.requestWillBeSent", ({ requestId, request }) => {
			networkState.inflight.add(requestId);
			networkState.lastActivityAt = Date.now();
			const entry = networkState.responses.get(requestId) ?? {};
			entry.url = request?.url;
			networkState.responses.set(requestId, entry);
		});
		cdp.on("Network.responseReceived", ({ requestId, response }) => {
			const entry = networkState.responses.get(requestId) ?? {};
			entry.url = response?.url ?? entry.url;
			entry.status = response?.status;
			entry.mimeType = response?.mimeType;
			networkState.responses.set(requestId, entry);
			networkState.lastActivityAt = Date.now();
		});
		cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
			const entry = networkState.responses.get(requestId) ?? {};
			entry.encodedDataLength = encodedDataLength ?? 0;
			networkState.responses.set(requestId, entry);
			networkState.inflight.delete(requestId);
			networkState.lastActivityAt = Date.now();
		});
		cdp.on("Network.loadingFailed", ({ requestId, errorText }) => {
			const entry = networkState.responses.get(requestId) ?? {};
			entry.errorText = errorText;
			networkState.responses.set(requestId, entry);
			networkState.inflight.delete(requestId);
			networkState.lastActivityAt = Date.now();
		});

		await cdp.send("Page.enable");
		await cdp.send("Network.enable");
		await cdp.send("Runtime.enable");
		await cdp.send("Performance.enable");
		await cdp.send("HeapProfiler.enable");
		await cdp.send("HeapProfiler.startSampling", { samplingInterval: 32768 });
		await cdp.send("HeapProfiler.collectGarbage");
		const before = await cdp.send("Runtime.getHeapUsage");

		await cdp.send("Page.navigate", { url: args.url });
		await new Promise((resolveLoad) => cdp.on("Page.loadEventFired", resolveLoad));
		// The client fetches boundary topologies (~85 MB) from a React effect that
		// fires *after* the initial JS/data load goes quiet, so a single quiet-wait
		// misses them entirely. Wait for quiet, hold for waitMs, then wait for quiet
		// again to capture that second wave before measuring.
		await waitForNetworkQuiet(networkState, 2000, 60000);
		await delay(args.waitMs);
		await waitForNetworkQuiet(networkState, 2000, 60000);

		const afterLoad = await cdp.send("Runtime.getHeapUsage");
		const sampling = await cdp.send("HeapProfiler.stopSampling");
		await cdp.send("HeapProfiler.collectGarbage");
		await delay(1000);
		const afterGc = await cdp.send("Runtime.getHeapUsage");
		const domCounters = await cdp.send("Memory.getDOMCounters");
		const performanceMetrics = await cdp.send("Performance.getMetrics");

		await mkdir(outDir, { recursive: true });
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const reportJson = join(outDir, `atlas-memory-${stamp}.json`);
		const reportMd = join(outDir, `atlas-memory-${stamp}.md`);
		let heapSnapshotPath = null;

		if (args.heapSnapshot) {
			heapSnapshotPath = join(outDir, `atlas-memory-${stamp}.heapsnapshot`);
			// Stream chunks straight to disk. A full snapshot of a heavy heap can be
			// hundreds of MB; buffering it in an array would roughly double the
			// profiler's own footprint and risks an OOM on a memory-constrained box.
			const snapshotStream = createWriteStream(heapSnapshotPath);
			cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => snapshotStream.write(chunk));
			await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
			await new Promise((resolveSnap, rejectSnap) => {
				snapshotStream.end((error) => (error ? rejectSnap(error) : resolveSnap()));
			});
		}

		const responses = [...networkState.responses.values()]
			.filter((entry) => entry.url)
			.map((entry) => ({
				url: entry.url,
				status: entry.status ?? null,
				mimeType: entry.mimeType ?? null,
				encodedDataLength: entry.encodedDataLength ?? 0,
				errorText: entry.errorText ?? null,
			}));

		const totalEncodedDataLength = responses.reduce(
			(total, entry) => total + entry.encodedDataLength,
			0,
		);
		const sampled = sumSampleSizes(sampling.profile);
		const perf = Object.fromEntries(
			["JSHeapUsedSize", "JSHeapTotalSize", "Documents", "Nodes", "LayoutCount", "RecalcStyleCount"]
				.map((name) => [name, metricValue(performanceMetrics.metrics, name)]),
		);

		const report = {
			generatedAt: new Date().toISOString(),
			url: args.url,
			options: {
				waitMs: args.waitMs,
				heapSnapshot: args.heapSnapshot,
				headless: args.headless,
			},
			files: {
				reportJson,
				reportMarkdown: reportMd,
				heapSnapshot: heapSnapshotPath,
			},
			heap: {
				before,
				afterLoad,
				afterGc,
				retainedAfterGcDelta: afterGc.usedSize - before.usedSize,
			},
			domCounters,
			performance: perf,
			network: {
				totalEncodedDataLength,
				topResponses: responses
					.sort((a, b) => b.encodedDataLength - a.encodedDataLength)
					.slice(0, 80),
				failedResponses: responses.filter((entry) => entry.errorText),
			},
			heapSampling: sampled,
		};

		await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
		await writeFile(reportMd, writeMarkdown(report, heapSnapshotPath));

		console.log(`Wrote ${reportJson}`);
		console.log(`Wrote ${reportMd}`);
		if (heapSnapshotPath) console.log(`Wrote ${heapSnapshotPath}`);
		console.log(`JS heap after GC: ${bytes(afterGc.usedSize)} used / ${bytes(afterGc.totalSize)} total`);
		console.log(`Observed network payload: ${bytes(totalEncodedDataLength)}`);

		cdp.close();
	} catch (error) {
		if (stderr) console.error(stderr);
		throw error;
	} finally {
		// Wait for Chrome to fully exit before removing its user-data-dir, otherwise
		// it may still be flushing files and rmdir races with ENOTEMPTY. retryMaxRetries
		// covers any straggling writes.
		const chromeExit = new Promise((resolveExit) => chrome.once("exit", resolveExit));
		chrome.kill("SIGTERM");
		await Promise.race([chromeExit, delay(5000)]);
		await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
