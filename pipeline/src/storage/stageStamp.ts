import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A check stage leaves a stamp here, as the record that it passed. The data
 * build tracks the stamp as the stage's output.
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
