import { sha256Hex } from "../lib/hash.ts";
import { rename, stat, writeFile } from "fs/promises";
import { join } from "path";
import { formatCount, type ArtifactResult } from "@uk-data-atlas/atlas-db";
import type { CompiledOutput, FileSnapshot } from "./types.mts";

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

/**
 * Writes `name`.json into `directory` and describes the result.
 */
export const out = async (
	name: string,
	data: unknown,
	directory: string,
): Promise<Required<CompiledOutput>> => {
	const json = JSON.stringify(data);
	const path = join(directory, `${name}.json`);
	await writeAtomically(path, json);
	return {
		bytes: Buffer.byteLength(json, "utf8"),
		sha256: sha256Hex(json),
		modifiedAt: (await stat(path)).mtimeMs,
	};
};

/** The artifact result for the region chunk files: how many, and their total size. */
export const chunksResult = (
	status: string,
	snapshots: readonly FileSnapshot[],
	ms: number,
): ArtifactResult => ({
	status: `${status}, ${formatCount(snapshots.length)} files`,
	bytes: snapshots.reduce((total, snapshot) => total + snapshot.bytes, 0),
	ms,
});
