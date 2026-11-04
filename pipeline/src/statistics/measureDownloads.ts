import { createHash } from "node:crypto";
import {
	createReadStream,
	createWriteStream,
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { DatabaseSync } from "node:sqlite";
import type { ObservationDownload } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	exportStatisticsMeasure,
	type StatisticsSelection,
} from "./statisticsExport.ts";

async function fileHash(path: string): Promise<string> {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}

/** Write both representations without retaining a measure's rows or bytes in Node. */
export async function compileMeasureDownloads(
	database: DatabaseSync,
	publicDirectory: string,
	measure: string,
	selection: readonly StatisticsSelection[],
): Promise<ObservationDownload[]> {
	const directory = join(publicDirectory, "exports", "measures");
	mkdirSync(directory, { recursive: true });
	const temporary = mkdtempSync(join(directory, ".build-"));
	try {
		const csv = join(temporary, "rows.csv");
		const parquet = join(temporary, "rows.parquet");
		const compressed = join(temporary, "rows.csv.gz");
		const count = exportStatisticsMeasure(
			database,
			measure,
			{ csv, parquet },
			selection,
		);
		if (!count)
			throw new Error(`${measure}: no canonical observation rows`);
		const csvHash = await fileHash(csv);
		const parquetHash = await fileHash(parquet);
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
		return [
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
		];
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}
