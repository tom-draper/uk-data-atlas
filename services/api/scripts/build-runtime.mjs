import { build } from "esbuild";
import { resolve } from "node:path";

await build({
	absWorkingDir: resolve(import.meta.dirname, ".."),
	entryPoints: {
		serve: "scripts/serve.ts",
		"build-atlas-cache": "scripts/build-atlas-cache.ts",
		"profile-startup": "scripts/profile-startup.ts",
		"usage-report": "scripts/usage-report.ts",
	},
	outdir: "dist",
	outExtension: { ".js": ".mjs" },
	bundle: true,
	platform: "node",
	target: "node24",
	format: "esm",
	sourcemap: true,
	banner: {
		js: 'import { createRequire as runtimeRequire } from "node:module"; const require = runtimeRequire(import.meta.url);',
	},
});

await build({
	absWorkingDir: resolve(import.meta.dirname, ".."),
	entryPoints: ["polygon-clipping"],
	outfile: "dist/polygon-clipping.cjs",
	bundle: true,
	platform: "node",
	target: "node24",
	format: "cjs",
});
