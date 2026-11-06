import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildLog } from "../packages/atlas-runtime/src/storage/buildTiming.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = { cwd: root, shell: process.platform === "win32" };
const force = process.env.ATLAS_FORCE_DATA_BUILD === "1";
// Only whether the published files are current. The parity checks that
// `pnpm data:verify` adds read build intermediates and are slow, and a failed
// one is not a reason to regenerate the data.
const fresh =
	!force &&
	spawnSync("pnpm", ["exec", "tsx", "scripts/verify-data.mts"], options)
		.status === 0;

if (fresh) {
	buildLog.info("Local data is up to date, skipping regeneration");
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
