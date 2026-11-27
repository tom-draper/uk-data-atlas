import { rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import type { DataCatalog, StatisticsReadPath } from "@uk-data-atlas/measures";
import { sha256Hex } from "../lib/hash.ts";
import { compileObservationDownloads } from "../statistics/observationDownloads.ts";
import {
	compileMeasureDownloads,
	compileUncachedMeasureDownloads,
} from "../statistics/measureDownloads.ts";
import {
	cacheDownload,
	usableDownload,
	type CachedDownload,
} from "../statistics/exportDownloadReuse.ts";
import { measureStatisticsSelections } from "../statistics/measureStatisticsSelections.ts";
import { statisticsArtifactReader } from "../statistics/statisticsArtifacts.ts";
import { createMeasureSourceExporter } from "./exportManifest.ts";

export type ExportWork = {
	catalog: DataCatalog;
	readPath: StatisticsReadPath;
	databasePath: string;
	publicDirectory: string;
	scratch: string;
	writerKey: string | undefined;
	previous: Record<string, CachedDownload>;
	cursor: Int32Array<SharedArrayBuffer>;
};

export async function compileMeasureExports(work: ExportWork) {
	const { catalog, publicDirectory, cursor, writerKey, previous } = work;
	const database = new DatabaseSync(work.databasePath, { readOnly: true });
	const identities = Object.fromEntries(
		catalog.measures.flatMap(({ id, series }) =>
			series ? [[id, series]] : [],
		),
	);
	const cache: Array<[string, CachedDownload]> = [];
	const results = [];
	let reused = 0;
	let downloadCount = 0;
	try {
		const readArtifact = statisticsArtifactReader(
			database,
			catalog,
			work.readPath,
		);
		const compileSourceExports = createMeasureSourceExporter(
			readArtifact,
			(content, entry, artifact, unit, seriesKey) => {
				downloadCount++;
				if (writerKey === undefined)
					return compileObservationDownloads(
						publicDirectory,
						entry,
						artifact,
						unit,
						seriesKey,
					);
				const stem = `exports/${entry.id}`;
				const key = sha256Hex(
					JSON.stringify([
						writerKey,
						entry,
						unit,
						seriesKey,
						sha256Hex(content),
					]),
				);
				const prior = previous[stem];
				if (
					prior?.key === key &&
					usableDownload(publicDirectory, prior, stem)
				) {
					reused++;
					rmSync(join(publicDirectory, `${stem}.csv`), {
						force: true,
					});
					cache.push([stem, prior]);
					return prior.formats;
				}
				const formats = compileObservationDownloads(
					publicDirectory,
					entry,
					artifact,
					unit,
					seriesKey,
				);
				cache.push([
					stem,
					cacheDownload(publicDirectory, key, formats),
				]);
				return formats;
			},
		);
		for (
			let index = Atomics.add(cursor, 0, 1);
			index < catalog.measures.length;
			index = Atomics.add(cursor, 0, 1)
		) {
			const measure = catalog.measures[index]!;
			const sources = compileSourceExports(measure);
			const selection = measureStatisticsSelections(
				database,
				measure,
				work.readPath,
				identities,
			);
			let canonical;
			if (selection) {
				const stem = `exports/measures/${measure.id}`;
				const prior = previous[stem];
				downloadCount++;
				const record =
					writerKey === undefined
						? {
								formats: await compileUncachedMeasureDownloads(
									database,
									publicDirectory,
									measure.id,
									selection,
									work.scratch,
								),
							}
						: await compileMeasureDownloads(
								database,
								publicDirectory,
								measure.id,
								selection,
								work.scratch,
								writerKey,
								prior,
							);
				if ("key" in record) {
					if (record === prior) reused++;
					cache.push([stem, record]);
				}
				canonical = { measureId: measure.id, formats: record.formats };
			}
			results.push({ index, sources, canonical });
		}
		return { results, cache, reused, downloadCount };
	} catch (error) {
		Atomics.store(cursor, 0, catalog.measures.length);
		throw error;
	} finally {
		database.close();
	}
}

if (!isMainThread && parentPort && workerData?.role === "measure-exports") {
	parentPort.postMessage(await compileMeasureExports(workerData.work));
}
