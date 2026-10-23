import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = { cwd: root, shell: process.platform === "win32" };
const force = process.env.ATLAS_FORCE_PRECOMPILE === "1";
const fresh =
	!force && spawnSync("pnpm", ["precompile:verify"], options).status === 0;

if (fresh) {
	console.log("Local precompiled data is up to date; skipping regeneration.");
} else {
	const child = spawnSync("pnpm", ["data:build", "--target", "website"], {
		...options,
		stdio: "inherit",
	});
	if (child.error) throw child.error;
	if (child.signal) process.kill(process.pid, child.signal);
	else process.exit(child.status ?? 1);
}
