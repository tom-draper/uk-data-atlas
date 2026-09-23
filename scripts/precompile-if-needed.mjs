import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = join(root, "public", "data", "datasets", "dataset-manifest.json");

async function newestMtime(directory) {
	let newest = 0;
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return newest;
	}

	for (const entry of entries) {
		if (entry.name === "node_modules")
			continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory())
			newest = Math.max(newest, await newestMtime(path));
		else if (!entry.name.endsWith(".tmp"))
			newest = Math.max(newest, (await stat(path)).mtimeMs);
	}
	return newest;
}

const force = process.env.ATLAS_FORCE_PRECOMPILE === "1";
let manifestMtime = 0;
try {
	manifestMtime = (await stat(manifest)).mtimeMs;
} catch {
	// A fresh checkout or an incomplete build needs a full precompile.
}

const sourceMtime = await newestMtime(join(root, "data"));
if (!force && manifestMtime > sourceMtime) {
	console.log("Precompiled data is up to date; skipping regeneration.");
} else {
	const child = spawn("pnpm", ["precompile"], {
		cwd: root,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	child.on("exit", (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else process.exit(code ?? 1);
	});
}
