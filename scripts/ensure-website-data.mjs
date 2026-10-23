import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = { cwd: root, shell: process.platform === "win32" };
const force = process.env.ATLAS_FORCE_DATA_BUILD === "1";
const fresh =
	!force && spawnSync("pnpm", ["data:verify"], options).status === 0;

if (fresh) {
	console.log("Local data is up to date; skipping regeneration.");
} else {
	const child = spawnSync("pnpm", ["data:build"], {
		...options,
		stdio: "inherit",
	});
	if (child.error) throw child.error;
	if (child.signal) process.kill(process.pid, child.signal);
	else process.exit(child.status ?? 1);
}

const seo = spawnSync("pnpm", ["exec", "tsx", "scripts/build-seo-data.mts"], {
	...options,
	stdio: "inherit",
});
if (seo.error) throw seo.error;
if (seo.signal) process.kill(process.pid, seo.signal);
else process.exit(seo.status ?? 1);
