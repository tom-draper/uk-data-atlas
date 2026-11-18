import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A stage whose output is only a record leaves a stamp here: a check stage,
 * as the record that it passed, and `atlas-cache-stamp`, as the hash of the
 * `atlas.sqlite` it stamped the cache with.
 */
export const STAMP_DIRECTORY = "data/build/.stamps";

export const stageStampPath = (root: string, stage: string) =>
	join(root, STAMP_DIRECTORY, `${stage}.json`);

/** Writes the stamp in one step, so a reader never sees half of it. */
export function writeStageStamp(
	root: string,
	stage: string,
	value: Record<string, string>,
) {
	const path = stageStampPath(root, stage);
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, `${JSON.stringify(value)}\n`);
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}
