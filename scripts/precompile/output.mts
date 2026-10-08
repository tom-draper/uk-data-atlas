import { createHash } from "crypto";
import { rename, stat, writeFile } from "fs/promises";
import { join } from "path";
import { formatKb } from "../timing.mts";
import { OUT_DIR } from "./paths.mts";
import type { CompiledOutput, FileSnapshot } from "./types.mts";

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

/** Writes `name`.json into the browser data folder and describes the result. */
export const out = async (
	name: string,
	data: unknown,
): Promise<Required<CompiledOutput>> => {
	const json = JSON.stringify(data);
	const path = join(OUT_DIR, `${name}.json`);
	await writeAtomically(path, json);
	return {
		bytes: Buffer.byteLength(json, "utf8"),
		sha256: createHash("sha256").update(json).digest("hex"),
		modifiedAt: (await stat(path)).mtimeMs,
	};
};

/** How many region chunk files there are, and their total size. */
export const chunksSize = (snapshots: readonly FileSnapshot[]) =>
	`${snapshots.length} files, ${formatKb(
		snapshots.reduce((total, snapshot) => total + snapshot.bytes, 0),
	)}`;
