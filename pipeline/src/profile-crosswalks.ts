/** Force selected compiles into a temporary directory and check existing hashes. */
import { apiRootOf, artifactRoot } from "../../shared/dataLayout";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readCrosswalkAdapters } from "../../shared/crosswalkAdapters";
import {
	compileCrosswalks,
	type CrosswalkArtifact,
} from "../../shared/crosswalkCompiler";
import { readGeometrySourceLookup } from "../../shared/geometrySources";
import { readStoredText, storedTextExists } from "../../shared/storedText";
import { sha256 } from "../../shared/contentHash";
import { readCompiledAreaLookup } from "./crosswalk-build-inputs";
import { writeCrosswalkArtifact } from "./crosswalk-artifact";
import {
	compileCrosswalksInWorkers,
	crosswalkWorkerCount,
} from "./crosswalk-workers";

const root = resolve(import.meta.dirname, "../..");
const apiRoot = apiRootOf(root);
const args = process.argv.slice(2);
const workerFlag = args.find((arg) => arg.startsWith("--workers="));
const workers = crosswalkWorkerCount(
	workerFlag?.slice("--workers=".length) ?? process.env.CROSSWALK_WORKERS,
);
const ids = args.filter((arg) => arg !== workerFlag);
if (!ids.length)
	throw new Error(
		"Usage: pnpm exec tsx pipeline/src/profile-crosswalks.ts [--workers=1] <crosswalk-id> [...]",
	);
const adapters = readCrosswalkAdapters(
	join(apiRoot, "config/crosswalk-adapters.json"),
);
const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
const selected = new Set<string>();
const include = (id: string) => {
	const adapter = byId.get(id);
	if (!adapter) throw new Error(`Unknown crosswalk ${id}.`);
	if (selected.has(id)) return;
	selected.add(id);
	if (adapter.method === "population-overlap") include(adapter.pairs);
};
ids.forEach(include);
const tasks = adapters.filter(({ id }) => selected.has(id));
const outputDirectory = mkdtempSync(join(tmpdir(), "atlas-crosswalk-profile-"));
let completed = 0;
const started = performance.now();
const report = (artifact: CrosswalkArtifact, seconds: number) => {
	const stored = join(
		artifactRoot(apiRoot),
		"crosswalks",
		`${artifact.id}.json`,
	);
	let matchesStored: boolean | null = null;
	if (storedTextExists(stored)) {
		const { contentHash, ...content } = JSON.parse(
			readStoredText(stored),
		) as CrosswalkArtifact;
		matchesStored =
			contentHash === sha256(JSON.stringify(content)) &&
			contentHash === artifact.contentHash;
		if (!matchesStored)
			throw new Error(
				`${artifact.id}: compiled artifact differs from the stored baseline.`,
			);
	}
	completed++;
	console.log(
		JSON.stringify({
			id: artifact.id,
			method: artifact.method,
			seconds,
			records: artifact.records.length,
			contentHash: artifact.contentHash,
			matchesStored,
		}),
	);
};
try {
	if (workers === 1) {
		const { areaLookup } = readCompiledAreaLookup(artifactRoot(apiRoot));
		let taskStarted = performance.now();
		for (const artifact of compileCrosswalks(
			root,
			tasks,
			areaLookup,
			readGeometrySourceLookup(apiRoot),
		)) {
			writeCrosswalkArtifact(outputDirectory, artifact);
			report(artifact, (performance.now() - taskStarted) / 1000);
			taskStarted = performance.now();
		}
	} else {
		await compileCrosswalksInWorkers({
			repositoryRoot: root,
			outputDirectory,
			adapters: tasks,
			workers,
			onCompiled: report,
		});
	}
	if (completed !== tasks.length)
		throw new Error(
			`Expected ${tasks.length} compiles, received ${completed}.`,
		);
	console.log(
		JSON.stringify({
			completed,
			workers,
			wallSeconds: (performance.now() - started) / 1000,
			parentPeakRssMiB: process.resourceUsage().maxRSS / 1024,
		}),
	);
} finally {
	rmSync(outputDirectory, { recursive: true, force: true });
}
