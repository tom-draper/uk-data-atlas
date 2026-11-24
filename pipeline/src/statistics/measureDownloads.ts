import {
	createReadStream,
	createWriteStream,
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	statSync,
} from "node:fs";
import { createHash, type Hash } from "node:crypto";
import { join } from "node:path";
import { sha256FileHex } from "../lib/hash.ts";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
	readStatisticsExport,
	writeStatisticsExport,
	type StatisticsSelection,
} from "./statisticsExport.ts";

import {
	cacheDownload,
	usableDownload,
	type CachedDownload,
} from "./exportDownloadReuse.ts";

function hashRow(hash: Hash, row: SQLOutputValue[]) {
	// Parquet doubles distinguish negative zero, and JSON loses nonfinite values.
	const exceptional = row.some(
		(value) =>
			typeof value === "number" &&
			(!Number.isFinite(value) || Object.is(value, -0)),
	);
	const values = exceptional
		? row.map((value) =>
				typeof value === "number" &&
				(!Number.isFinite(value) || Object.is(value, -0))
					? { number: Object.is(value, -0) ? "-0" : String(value) }
					: value,
			)
		: row;
	hash.update(`${JSON.stringify(values)}\n`);
}

/** Write both representations without retaining a measure's rows or bytes in Node. */
export async function compileMeasureDownloads(
	database: DatabaseSync,
	publicDirectory: string,
	measure: string,
	selection: readonly StatisticsSelection[],
	scratch: string,
	writerKey: string,
	previous?: CachedDownload,
): Promise<CachedDownload> {
	const { columns, rows } = readStatisticsExport(
		database,
		measure,
		selection,
	);
	const seed = createHash("sha256").update(
		JSON.stringify([writerKey, measure, selection, columns]),
	);
	const stem = `exports/measures/${measure}`;
	const trackRows = function* (hash: Hash) {
		for (const row of rows()) {
			hashRow(hash, row);
			yield row;
		}
	};
	let key: string | undefined;
	if (usableDownload(publicDirectory, previous, stem)) {
		const hash = seed.copy();
		for (const row of rows()) hashRow(hash, row);
		key = hash.digest("hex");
		if (key === previous.key) return previous;
	}
	mkdirSync(join(publicDirectory, "exports", "measures"), {
		recursive: true,
	});
	const temporary = mkdtempSync(join(scratch, "measure-"));
	try {
		const csv = join(temporary, "rows.csv");
		const parquet = join(temporary, "rows.parquet");
		const compressed = join(temporary, "rows.csv.gz");
		const count = writeStatisticsExport(
			{ csv, parquet },
			columns,
			key ? rows() : trackRows(seed),
		);
		if (!count)
			throw new Error(`${measure}: no canonical observation rows`);
		const csvHash = await sha256FileHex(csv);
		const parquetHash = await sha256FileHex(parquet);
		await pipeline(
			createReadStream(csv),
			createGzip({ level: 9 }),
			createWriteStream(compressed),
		);
		const csvArtifact = `exports/measures/${measure}-${csvHash}.csv.gz`;
		const parquetArtifact = `exports/measures/${measure}-${parquetHash}.parquet`;
		const csvBytes = statSync(csv).size;
		const gzipBytes = statSync(compressed).size;
		const parquetBytes = statSync(parquet).size;
		renameSync(compressed, join(publicDirectory, csvArtifact));
		renameSync(parquet, join(publicDirectory, parquetArtifact));
		return cacheDownload(publicDirectory, key ?? seed.digest("hex"), [
			{
				format: "csv",
				artifact: csvArtifact,
				href: `/v1/data/${measure}/export?format=csv&hash=${csvHash}`,
				bytes: csvBytes,
				gzipBytes,
				contentHash: `sha256:${csvHash}`,
			},
			{
				format: "parquet",
				artifact: parquetArtifact,
				href: `/v1/data/${measure}/export?format=parquet&hash=${parquetHash}`,
				bytes: parquetBytes,
				contentHash: `sha256:${parquetHash}`,
			},
		]);
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}
