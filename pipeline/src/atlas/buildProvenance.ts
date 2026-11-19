import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hashFile } from "../lib/fileHashCache.ts";

/** Provenance describes the assembly that produced the file, including cached builds. */
export function buildProvenance(
	root: string,
	workPath: string,
	/** The build metadata assembled with the database, which the id also covers. */
	buildWorkPath: string,
): Record<string, string> {
	const facts: Record<string, string> = {};
	const releasePath = join(root, "data-release.json");
	if (existsSync(releasePath))
		facts.dataRelease = readFileSync(releasePath, "utf8").trim();

	// Do not accidentally use a parent checkout for a fixture or exported source tree.
	if (existsSync(join(root, ".git"))) {
		try {
			const git = (...args: string[]) =>
				execFileSync("git", ["-C", root, ...args], {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
					env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
				}).trim();
			const commit = git("rev-parse", "HEAD");
			const dirty =
				git("status", "--porcelain", "--untracked-files=normal") !== "";
			facts.gitCommit = commit;
			facts.gitDirty = String(dirty);
		} catch {
			// A source archive, missing Git executable, or unborn repository has no Git provenance.
		}
	}

	const epoch = process.env.SOURCE_DATE_EPOCH;
	if (epoch !== undefined) {
		if (
			!/^\d+$/.test(epoch) ||
			!Number.isSafeInteger(Number(epoch)) ||
			Number(epoch) > 8640000000000
		)
			throw new Error(
				"SOURCE_DATE_EPOCH must be a valid non-negative Unix timestamp in seconds",
			);
		facts.buildTimestamp = new Date(Number(epoch) * 1000).toISOString();
	}
	// The temporary assembled files predate provenance and final VACUUM.
	// They avoid a circular file hash and change when the assembled content does.
	facts.buildId = `sha256:${createHash("sha256")
		.update(
			JSON.stringify({
				workHash: hashFile(workPath),
				buildWorkHash: hashFile(buildWorkPath),
				facts,
			}),
		)
		.digest("hex")}`;
	return facts;
}
