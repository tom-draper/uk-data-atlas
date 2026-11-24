import {
	artifactDirectory,
	atlasBaseDatabasePath,
	statisticsReadPathPath,
} from "@uk-data-atlas/atlas-db";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { DataCatalog, StatisticsReadPath } from "@uk-data-atlas/measures";
import {
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { sha256FileHexSync } from "../lib/hash.ts";
import { readJsonSync } from "../lib/json.ts";
import type { CachedDownload } from "../statistics/exportDownloadReuse.ts";
import { assembleExportManifest } from "./exportManifest.ts";
import { compileMeasureExports, type ExportWork } from "./measureExports.ts";

type WorkResult = Awaited<ReturnType<typeof compileMeasureExports>>;
type Cache = { writerKey: string; downloads: Record<string, CachedDownload> };

function writerFingerprint() {
	// Also invalidate reuse when the encoders or their runtime settings change.
	const sources = [
		"../statistics/observationDownloads.ts",
		"../statistics/measureDownloads.ts",
		"../statistics/statisticsExport.ts",
		"../../../packages/artifacts/src/parquet.ts",
	];
	return sha256(
		JSON.stringify([
			process.version,
			process.versions.zlib,
			process.platform,
			process.arch,
			...sources.map((path) =>
				sha256FileHexSync(
					fileURLToPath(new URL(path, import.meta.url)),
				),
			),
		]),
	);
}

function readExportCache(path: string, writerKey: string) {
	try {
		const cache = readJsonSync<Cache>(path);
		if (
			cache?.writerKey === writerKey &&
			cache.downloads &&
			typeof cache.downloads === "object"
		)
			return cache.downloads;
	} catch (error) {
		if (
			!(error instanceof SyntaxError) &&
			(error as NodeJS.ErrnoException).code !== "ENOENT"
		)
			throw error;
	}
	return {};
}

function startWorker(work: ExportWork) {
	const worker = new Worker(new URL("./measureExports.ts", import.meta.url), {
		workerData: { role: "measure-exports", work },
	});
	const result = new Promise<WorkResult>((done, fail) => {
		worker.once("message", done);
		worker.once("error", fail);
		worker.once("exit", (code) =>
			fail(
				new Error(
					`Export worker stopped before returning its results (${code})`,
				),
			),
		);
	}).catch((error) => {
		Atomics.store(work.cursor, 0, work.catalog.measures.length);
		throw error;
	});
	return { worker, result };
}

export const buildExportManifest = async (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const catalog = readJsonSync<DataCatalog>(
		join(publicDirectory, "data-catalog.json"),
	);
	const readPath = readJsonSync<StatisticsReadPath>(
		statisticsReadPathPath(repositoryRoot),
	);
	const requested = process.env.DATA_EXPORT_JOBS ?? "1";
	if (requested !== "1" && requested !== "2")
		throw new Error("DATA_EXPORT_JOBS must be 1 or 2.");
	const workerCount = Math.min(
		Number(requested),
		availableParallelism(),
		Math.max(1, catalog.measures.length),
	);
	const writerKey = writerFingerprint();
	const useCache = process.env.DATA_BUILD_NO_CACHE !== "1";
	const cachePath = resolve(
		repositoryRoot,
		process.env.DATA_BUILD_CACHE_DIR ?? ".cache/data-build",
		"measure-exports.json",
	);
	const previous = useCache ? readExportCache(cachePath, writerKey) : {};
	const exportsDirectory = join(publicDirectory, "exports");
	mkdirSync(exportsDirectory, { recursive: true });
	const scratch = mkdtempSync(join(exportsDirectory, ".measure-exports-"));
	const work: ExportWork = {
		catalog,
		readPath,
		databasePath: atlasBaseDatabasePath(repositoryRoot),
		publicDirectory,
		scratch,
		previous,
		writerKey,
		cursor: new Int32Array(new SharedArrayBuffer(4)),
	};
	const background = [];
	try {
		for (let worker = 1; worker < workerCount; worker++)
			background.push(startWorker(work));
		const completed = await Promise.allSettled([
			...background.map((job) => job.result),
			compileMeasureExports(work),
		]);
		const batches = completed.map((result) => {
			if (result.status === "rejected") throw result.reason;
			return result.value;
		});
		const ordered = batches
			.flatMap((batch) => batch.results)
			.sort((left, right) => left.index - right.index);
		const manifest = assembleExportManifest(
			catalog,
			ordered.flatMap((result) => result.sources),
		);
		manifest.measureExports = ordered.flatMap(({ canonical }) =>
			canonical ? [canonical] : [],
		);
		const { contentHash: _previousHash, ...content } = manifest;
		manifest.contentHash = sha256(JSON.stringify(content));
		const outputPath = join(publicDirectory, "export-manifest.json");
		const staged = join(scratch, "export-manifest.json");
		writeFileSync(staged, `${JSON.stringify(manifest, null, "\t")}\n`);
		renameSync(staged, outputPath);
		if (useCache) {
			mkdirSync(dirname(cachePath), { recursive: true });
			const tempCache = mkdtempSync(
				join(dirname(cachePath), ".exports-"),
			);
			try {
				const path = join(tempCache, "downloads.json");
				writeFileSync(
					path,
					JSON.stringify({
						writerKey,
						downloads: Object.fromEntries(
							batches.flatMap((batch) => batch.cache),
						),
					}),
				);
				renameSync(path, cachePath);
			} finally {
				rmSync(tempCache, { recursive: true, force: true });
			}
		}
		return {
			outputPath,
			exportCount: manifest.exports.length,
			reused: batches.reduce((count, batch) => count + batch.reused, 0),
			downloadCount: batches.reduce(
				(count, batch) => count + batch.cache.length,
				0,
			),
			workerCount,
		};
	} finally {
		await Promise.all(background.map((job) => job.worker.terminate()));
		rmSync(scratch, { recursive: true, force: true });
	}
};
