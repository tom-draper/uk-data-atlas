/**
 * Copies runtime boundary assets from data/ into public/data/.
 * Precompiled datasets are written there separately by precompile-data.ts.
 *
 * Run automatically via: pnpm dev / pnpm build
 */

import { promises as fs } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "data");
const DEST = join(ROOT, "public", "data");

const SERVE_EXTENSIONS = new Set([".topojson"]);
const SOURCE_DATA_EXTENSIONS = new Set([".csv", ".xlsx", ".xls", ".ods"]);
const PRECOMPILED = join(SRC, "precompiled");
const RUNTIME_SNAPSHOT = join(SRC, "precompiled", "runtime");

async function removeSourceDataCopies(dir = DEST) {
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			await removeSourceDataCopies(path);
		} else if (
			SOURCE_DATA_EXTENSIONS.has(extname(entry.name).toLowerCase())
		) {
			await fs.unlink(path);
			console.log(
				`  removed source data copy: ${path.replace(ROOT + "/", "")}`,
			);
		}
	}
}

async function sync(src, dest) {
	let entries;
	try {
		entries = await fs.readdir(src, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			// Runtime snapshots are copied directly to public/data above; nesting
			// them under public/data/precompiled/runtime would double the deploy.
			if (src === PRECOMPILED && entry.name === "runtime") continue;
			await sync(srcPath, destPath);
		} else if (SERVE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
			await fs.mkdir(dirname(destPath), { recursive: true });

			try {
				const [srcStat, destStat] = await Promise.all([
					fs.stat(srcPath),
					fs.stat(destPath),
				]);
				if (srcStat.mtimeMs <= destStat.mtimeMs) continue;
			} catch {
				// dest doesn't exist yet
			}

			await fs.copyFile(srcPath, destPath);
			console.log(`  synced: ${destPath.replace(ROOT + "/", "")}`);
		}
	}
}

async function syncRuntimeSnapshot() {
	await fs.rm(join(DEST, "precompiled", "runtime"), {
		recursive: true,
		force: true,
	});
	try {
		await fs.cp(RUNTIME_SNAPSHOT, DEST, { recursive: true });
		console.log("  synced committed runtime boundary assets");
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}

console.log("Syncing public data from data/ ...");
await removeSourceDataCopies();
await syncRuntimeSnapshot();
await sync(SRC, DEST);
console.log("Done.");
