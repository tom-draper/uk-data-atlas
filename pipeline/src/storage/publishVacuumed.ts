import { closeSync, fsyncSync, openSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type PublishVacuumedOptions = {
	/**
	 * Runs on the vacuumed copy before it is made durable, for a last change
	 * that belongs in the published file but not in the working one.
	 */
	finish?: (database: DatabaseSync) => void;
	/** Runs just before the rename, to release readers holding the old file. */
	beforeReplace?: () => void;
};

function syncFile(path: string) {
	const descriptor = openSync(path, "r+");
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

/** Makes the rename durable. Not every platform can sync a directory. */
function syncDirectory(path: string) {
	try {
		const descriptor = openSync(path, "r");
		try {
			fsyncSync(descriptor);
		} finally {
			closeSync(descriptor);
		}
	} catch {
		// The rename has happened either way.
	}
}

/**
 * Publish a database as one compact file: `VACUUM INTO` a temporary file
 * beside `publishedPath`, sync it, and rename it into place. A build calls
 * this once per database, however many stages wrote to the working file, so
 * the file is rewritten once instead of once per stage. The published path is
 * either its old file or the complete new one, never part of either.
 *
 * `workPath` is left as it was; the caller removes it. The copy keeps the
 * source's page size, auto_vacuum, user_version and application_id, but not
 * journal_mode, which is the default again. A stale `.tmp` from a build that
 * stopped is removed first, as `VACUUM INTO` needs a target that is absent.
 */
export function publishVacuumed(
	workPath: string,
	publishedPath: string,
	{ finish, beforeReplace }: PublishVacuumedOptions = {},
) {
	const temporary = `${publishedPath}.tmp`;
	const remove = () => {
		rmSync(temporary, { force: true });
		rmSync(`${temporary}-journal`, { force: true });
	};
	remove();
	try {
		const source = new DatabaseSync(workPath);
		try {
			source.prepare("VACUUM INTO ?").run(temporary);
		} finally {
			source.close();
		}
		if (finish) {
			const copy = new DatabaseSync(temporary);
			try {
				copy.exec("PRAGMA journal_mode = OFF");
				finish(copy);
			} finally {
				copy.close();
			}
		}
		syncFile(temporary);
		beforeReplace?.();
		renameSync(temporary, publishedPath);
	} finally {
		remove();
	}
	syncDirectory(dirname(publishedPath));
	return publishedPath;
}
