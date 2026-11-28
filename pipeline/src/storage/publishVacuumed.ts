import {
	ATLAS_APPLICATION_ID,
	ATLAS_SCHEMA_VERSION,
} from "@uk-data-atlas/atlas-db";
import { closeSync, fsyncSync, openSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { checkDatabase } from "./checkDatabase.ts";

export type PublishVacuumedOptions = {
	/**
	 * Runs on the vacuumed copy before it is made durable, for a last change
	 * that belongs in the published file but not in the working one.
	 */
	finish?: (database: DatabaseSync) => void;
	/** Internal caches do not use the atlas file family header. */
	atlasIdentity?: boolean;
	/** Validate the final copy before replacing the published file. */
	check?: "integrity_check" | "quick_check";
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
 * journal_mode, which is the default again. By default the published copy's
 * identity is then set to the current atlas file family and schema version. A stale `.tmp` from a build that
 * stopped is removed first, as `VACUUM INTO` needs a target that is absent.
 */
export function publishVacuumed(
	workPath: string,
	publishedPath: string,
	{
		finish,
		check,
		beforeReplace,
		atlasIdentity = true,
	}: PublishVacuumedOptions = {},
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
			source.exec("PRAGMA mmap_size = 2147483648");
			source.prepare("VACUUM INTO ?").run(temporary);
		} finally {
			source.close();
		}
		if (finish || check || atlasIdentity) {
			const copy = new DatabaseSync(temporary);
			try {
				copy.exec("PRAGMA journal_mode = OFF");
				if (atlasIdentity) {
					const hasMeta = copy
						.prepare(
							"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'meta'",
						)
						.get();
					if (hasMeta) {
						const version = copy
							.prepare(
								"SELECT value FROM meta WHERE key = 'schemaVersion'",
							)
							.get()?.value;
						if (
							version !== undefined &&
							version !== String(ATLAS_SCHEMA_VERSION)
						)
							throw new Error(
								`Cannot publish atlas schema version ${String(version)} as version ${ATLAS_SCHEMA_VERSION}`,
							);
					}
					copy.exec(
						`PRAGMA application_id = ${ATLAS_APPLICATION_ID}; PRAGMA user_version = ${ATLAS_SCHEMA_VERSION}`,
					);
				}
				finish?.(copy);
				if (check) checkDatabase(copy, check);
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
