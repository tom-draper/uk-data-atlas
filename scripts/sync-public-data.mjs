/**
 * Copies files needed by the dev server from data/ into public/data/.
 * Only topojson, CSV, and spreadsheet files are copied — large source files
 * (geojson, shapefiles) stay in data/ and are never served directly.
 *
 * Run automatically via: pnpm dev / pnpm build
 */

import { promises as fs } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "data");
const DEST = join(ROOT, "public", "data");

const SERVE_EXTENSIONS = new Set([
	".topojson",
	".csv",
	".xlsx",
	".xls",
	".ods",
]);

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

console.log("Syncing public data from data/ ...");
await sync(SRC, DEST);
console.log("Done.");
