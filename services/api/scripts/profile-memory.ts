import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiServer } from "../src/apiServer";
import { readApiCatalogues } from "../src/catalogueLoader";
import { readServeConfiguration } from "../src/serverOptions";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "../src/postcodeRoutes";
import {
	readMemoryScenarios,
	runMemoryWorkload,
	type MemoryScenario,
} from "./memory-profile/workload";

const scriptPath = fileURLToPath(import.meta.url);
const memory = () => ({
	...process.memoryUsage(),
	peakRssBytes: process.resourceUsage().maxRSS * 1024,
});

const worker = async () => {
	const config = readServeConfiguration(process.env);
	const apiRoot = resolve(
		process.env.ATLAS_API_ROOT ?? resolve(import.meta.dirname, ".."),
	);
	const beforeStartup = memory();
	const catalogues = readApiCatalogues(apiRoot, {
		geometryCacheReleases: config.geometryCacheReleases,
		crosswalkCacheBytes: config.crosswalkCacheBytes,
		observationCacheBytes: config.observationCacheBytes,
	});
	catalogues.areaGeometryCache?.warm(
		DEFAULT_POSTCODE_GEOGRAPHIES.flatMap((geography) => {
			const release = catalogues.geographyResolver.selectReleaseForDate(
				geography,
				"9999-12",
			);
			return release?.status === "selected"
				? [[geography, release.selected.id] as const]
				: [];
		}),
	);
	const server = createApiServer(catalogues, config.server);
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("No listening address");
	const beforeRequests = memory();
	let sampledHeapPeakBytes = beforeRequests.heapUsed;
	let sampledRssPeakBytes = beforeRequests.rss;
	const sample = () => {
		const current = memory();
		sampledHeapPeakBytes = Math.max(sampledHeapPeakBytes, current.heapUsed);
		sampledRssPeakBytes = Math.max(sampledRssPeakBytes, current.rss);
	};
	const timer = setInterval(sample, 20);
	process.on("disconnect", () => process.exit(1));
	process.once("message", () => {
		sample();
		clearInterval(timer);
		const afterRequests = memory();
		global.gc?.();
		process.send?.({
			type: "result",
			beforeStartup,
			beforeRequests,
			afterRequests,
			afterGc: global.gc ? memory() : null,
			sampledHeapPeakBytes,
			sampledRssPeakBytes,
		});
		server.close(() => process.disconnect?.());
	});
	process.send?.({
		type: "ready",
		port: address.port,
		releaseId: catalogues.atlasRelease.releaseId,
		configuration: {
			workers: 1,
			geometryCacheReleases: config.geometryCacheReleases,
			crosswalkCacheBytes: config.crosswalkCacheBytes,
			observationCacheBytes: config.observationCacheBytes,
			maxConcurrentRequests: config.server.maxConcurrentRequests,
			responseCacheBytes: config.server.responseCacheBytes,
			rateLimit: config.server.rateLimit ?? null,
		},
	});
};

const profileScenario = async (scenario: MemoryScenario) => {
	const child = fork(scriptPath, ["--worker"], {
		stdio: ["ignore", "ignore", "inherit", "ipc"],
	});
	const receive = (type: string) =>
		new Promise<Record<string, unknown>>((done, fail) => {
			const timer = setTimeout(
				() => finish(new Error(`Worker timed out waiting for ${type}`)),
				120000,
			);
			const exited = (
				code: number | null,
				signal: NodeJS.Signals | null,
			) =>
				finish(
					new Error(
						`Worker exited before ${type}: ${code ?? signal}`,
					),
				);
			const message = (value: unknown) => {
				if (
					typeof value === "object" &&
					value !== null &&
					"type" in value &&
					value.type === type
				)
					finish({ ...value });
			};
			const finish = (result: Error | Record<string, unknown>) => {
				clearTimeout(timer);
				child.off("message", message);
				child.off("exit", exited);
				child.off("error", finish);
				if (result instanceof Error) fail(result);
				else done(result);
			};
			child.on("message", message);
			child.once("exit", exited);
			child.once("error", finish);
		});
	try {
		const ready = await receive("ready");
		const traffic = await runMemoryWorkload(
			`http://127.0.0.1:${ready.port}`,
			scenario,
		);
		const result = receive("result");
		child.send("finish");
		return {
			name: scenario.name,
			path: scenario.path,
			concurrency: scenario.concurrency,
			method: scenario.method,
			encoding: scenario.encoding,
			bodyBytes: Buffer.byteLength(scenario.body ?? ""),
			releaseId: ready.releaseId,
			configuration: ready.configuration,
			traffic,
			memory: await result,
		};
	} finally {
		child.kill();
	}
};

export const profileMemory = async (planPath: string) => {
	const scenarios = readMemoryScenarios(
		JSON.parse(readFileSync(planPath, "utf8")),
	);
	const results = [];
	for (const scenario of scenarios) {
		process.stderr.write(`Profiling ${scenario.name}\n`);
		results.push(await profileScenario(scenario));
	}
	return {
		node: process.version,
		platform: process.platform,
		execArgv: process.execArgv,
		units: "bytes and milliseconds",
		limitations:
			"One fresh local worker per scenario. OS peak RSS includes startup. Heap and RSS samples can miss allocations during synchronous work. Load-generator memory is excluded. This is not a production sizing guarantee.",
		results,
	};
};

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	if (process.argv[2] === "--worker")
		void worker().catch((error) => {
			console.error(error);
			process.exit(1);
		});
	else
		void profileMemory(
			resolve(
				process.argv[2] ??
					resolve(
						import.meta.dirname,
						"../benchmarks/memory-workload.json",
					),
			),
		)
			.then((report) => {
				console.log(JSON.stringify(report, null, 2));
				if (report.results.some((result) => !result.traffic.passed))
					process.exitCode = 1;
			})
			.catch((error) => {
				console.error(error);
				process.exitCode = 1;
			});
}
