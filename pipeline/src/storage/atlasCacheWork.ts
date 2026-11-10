import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	CACHE_STAGES,
	removeStageStamps,
	stageStampPath,
} from "./stageStamp.ts";
import { readJsonSync } from "../lib/json.ts";

/**
 * The atlas cache is rebuilt in a working copy, so a build copies the file
 * once, however many stages add to it. The first stage to write creates the
 * copy from the published `atlas-cache.sqlite`, later stages change it where
 * it is, and `atlas-cache-stamp` renames it into place when they are done.
 */
export const ATLAS_CACHE_WORK = "data/build/.atlas-cache.sqlite.work";

/**
 * The data build sets this to `1` for the stages it runs. A stage run by hand
 * leaves it unset and publishes its own change, as it always has.
 */
export const ATLAS_CACHE_WORK_ENV = "ATLAS_CACHE_WORK";

export const atlasCacheWorkPath = (root: string) =>
	join(root, ATLAS_CACHE_WORK);

export const defersCachePublish = (env: NodeJS.ProcessEnv = process.env) =>
	env[ATLAS_CACHE_WORK_ENV] === "1";

/** Names the working copy in its `meta` table, and in the stamps made in it. */
export const WORK_SESSION_KEY = "atlas-cache-work";

/** The id of a working copy, `null` if it has none, `undefined` if unreadable. */
function sessionOf(path: string) {
	try {
		const database = new DatabaseSync(path, { readOnly: true });
		try {
			const row = database
				.prepare("SELECT value FROM meta WHERE key = ?")
				.get(WORK_SESSION_KEY);
			return typeof row?.value === "string" ? row.value : null;
		} finally {
			database.close();
		}
	} catch {
		return undefined;
	}
}

function stampSession(root: string, stage: string) {
	try {
		const stamp = readJsonSync<{ session?: unknown } | null>(
			stageStampPath(root, stage),
		);
		return typeof stamp?.session === "string" ? stamp.session : null;
	} catch {
		return null;
	}
}

/**
 * Throws away a working copy left by a build that did not finish, with the
 * stamps that vouch for tables only it held: those made in this copy, or all
 * of them if the copy cannot be read. A stage stamped in an earlier build
 * keeps its stamp, as its tables were published. A stamp always goes first: a
 * stamp without tables would let the next build skip a stage that is missing
 * from the published file. Returns whether there was a copy to discard.
 */
export function discardAtlasCacheWork(root: string) {
	const path = atlasCacheWorkPath(root);
	if (!existsSync(path)) return false;
	const session = sessionOf(path);
	removeStageStamps(
		root,
		CACHE_STAGES.filter(
			(stage) =>
				session === undefined ||
				(session !== null && stampSession(root, stage) === session),
		),
	);
	rmSync(path, { force: true });
	return true;
}
