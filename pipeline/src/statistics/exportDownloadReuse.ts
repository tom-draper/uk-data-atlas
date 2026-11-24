import { join } from "node:path";
import type { ObservationDownload } from "@uk-data-atlas/catalogue/node";
import { sha256FileHexSync } from "../lib/hash.ts";

export type CachedDownload = {
	key: string;
	formats: ObservationDownload[];
	gzipHash: string;
};

export function cacheDownload(
	publicDirectory: string,
	key: string,
	formats: ObservationDownload[],
): CachedDownload {
	return {
		key,
		formats,
		gzipHash: sha256FileHexSync(
			join(publicDirectory, formats[0]!.artifact),
		),
	};
}

/** The files still have to exist and match, even if the inputs are unchanged. */
export function usableDownload(
	publicDirectory: string,
	record: CachedDownload | undefined,
	stem: string,
): record is CachedDownload {
	const [csv, parquet] = Array.isArray(record?.formats) ? record.formats : [];
	if (
		typeof record?.key !== "string" ||
		record.formats.length !== 2 ||
		csv?.format !== "csv" ||
		parquet?.format !== "parquet" ||
		typeof csv.artifact !== "string" ||
		typeof parquet.artifact !== "string" ||
		!csv.artifact.startsWith(stem) ||
		!parquet.artifact.startsWith(stem) ||
		!/^(?:-[a-f0-9]{64})?\.csv\.gz$/.test(
			csv.artifact.slice(stem.length),
		) ||
		!/^(?:-[a-f0-9]{64})?\.parquet$/.test(
			parquet.artifact.slice(stem.length),
		)
	)
		return false;
	try {
		return (
			sha256FileHexSync(join(publicDirectory, csv.artifact)) ===
				record.gzipHash &&
			`sha256:${sha256FileHexSync(join(publicDirectory, parquet.artifact))}` ===
				parquet.contentHash
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return false;
	}
}
