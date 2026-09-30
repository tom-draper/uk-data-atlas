import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = join(
	root,
	"public",
	"data",
	"datasets",
	"dataset-manifest.json",
);

// These are the source trees that can change a precompiled artifact. Keeping
// this list here means `dev` and `build` regenerate outputs after a loader,
// compiler, catalogue, parser or data-source change, rather than considering
// the raw data directory alone.
const precompileInputs = [
	join(root, "data"),
	join(root, "scripts"),
	join(root, "lib", "data"),
	join(root, "lib", "helpers"),
	join(root, "lib", "types"),
	join(root, "package.json"),
	join(root, "pnpm-lock.yaml"),
	join(root, "tsconfig.json"),
];

async function newestMtime(directory) {
	let newest = 0;
	let entries;
	try {
		const entry = await stat(directory);
		if (!entry.isDirectory()) return entry.mtimeMs;
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return newest;
	}

	for (const entry of entries) {
		if (entry.name === "node_modules") continue;
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

const inputMtime = Math.max(
	...(await Promise.all(precompileInputs.map((path) => newestMtime(path)))),
);
if (!force && manifestMtime > inputMtime) {
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
