import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "../lib/entrypoint.ts";
import { AssembleError, assembleModules } from "../modules/assembleModules.ts";

/**
 * Joins core and the named modules into one SQLite file.
 *
 *   pnpm data:assemble --modules economy,health --out my-atlas.sqlite
 *     [--release dev | --from <release folder>] [--allow-licence-conflict]
 *
 * It reads `sqlite/atlas-<id>.sqlite` and the manifests from a release tree,
 * `data/dist/uk-data-atlas-<release>` by default.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const valueOf = (args: string[], flag: string) => {
	const at = args.indexOf(flag);
	return at === -1 ? undefined : args[at + 1];
};

if (isMainModule(import.meta.url)) {
	const args = process.argv.slice(2);
	const modules = (valueOf(args, "--modules") ?? "")
		.split(",")
		.filter(Boolean);
	const out = valueOf(args, "--out");
	const from =
		valueOf(args, "--from") ??
		join(
			root,
			"data/dist",
			`uk-data-atlas-${valueOf(args, "--release") ?? "dev"}`,
		);
	if (!out) {
		console.error(
			"Usage: pnpm data:assemble --modules a,b --out file.sqlite",
		);
		process.exit(2);
	}
	try {
		const result = await assembleModules({
			root: from,
			modules,
			out: resolve(out),
			allowLicenceConflict: args.includes("--allow-licence-conflict"),
		});
		console.log(
			`Assembled core and ${result.modules.join(", ")} into ${result.out}`,
		);
	} catch (error) {
		if (!(error instanceof AssembleError)) throw error;
		console.error(error.message);
		process.exit(1);
	}
}
