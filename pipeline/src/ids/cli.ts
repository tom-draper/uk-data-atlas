import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { findIdMismatches } from "./databaseKeys.ts";
import {
	ID_DIRECTORY,
	IdRegistries,
	idDirectory,
	idNamespaces,
	idRegistryFile,
} from "./idRegistries.ts";
import { checkAppendOnly } from "./idRegistry.ts";
import { seedIdRegistries } from "./seedIds.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const USAGE = `Usage: pnpm ids <command>
  seed <database>          Start the empty registries in ${ID_DIRECTORY} from a database's ids
  verify <database>        Check every id in a database against the registries
  check [--base <ref>]     Check the registries are valid and only added to since a git ref (default HEAD)`;

const registryDatabase = (path: string | undefined) => {
	if (!path) throw new Error(USAGE);
	return new DatabaseSync(resolve(path), { readOnly: true });
};

const seed = (path: string | undefined) => {
	const database = registryDatabase(path);
	try {
		const ids = IdRegistries.load(idDirectory(root));
		const seeded = seedIdRegistries(database, ids);
		ids.save();
		for (const [namespace, size] of Object.entries(seeded))
			console.log(`${namespace}: ${size} ids`);
	} finally {
		database.close();
	}
};

const verify = (path: string | undefined) => {
	const database = registryDatabase(path);
	try {
		const { mismatches, checked } = findIdMismatches(
			database,
			IdRegistries.load(idDirectory(root)),
			{ limit: 20 },
		);
		for (const [namespace, count] of Object.entries(checked))
			console.log(`${namespace}: ${count} ids checked`);
		for (const m of mismatches)
			console.error(
				`${m.namespace} ${m.id} is ${m.key.join("/")}, which the registry gives ${m.registered ?? "no id"}`,
			);
		if (mismatches.length > 0) process.exitCode = 1;
	} finally {
		database.close();
	}
};

/** The file as it was at `ref`, or undefined if it was not there. */
const committed = (ref: string, path: string) => {
	try {
		return execFileSync(
			"git",
			["show", `${ref}:${relative(root, path).replaceAll("\\", "/")}`],
			{
				cwd: root,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				maxBuffer: 1 << 30,
			},
		);
	} catch {
		return undefined;
	}
};

const check = (ref: string) => {
	// Loading refuses blank lines, repeated keys and the wrong number of fields.
	IdRegistries.load(idDirectory(root));
	let failed = false;
	for (const name of idNamespaces) {
		const path = idRegistryFile(idDirectory(root), name);
		if (!existsSync(path)) {
			console.error(`Missing ${relative(root, path)}`);
			failed = true;
			continue;
		}
		const before = committed(ref, path);
		if (
			before !== undefined &&
			!checkAppendOnly(before, readFileSync(path, "utf8"))
		) {
			console.error(
				`${relative(root, path)} changes lines that are in ${ref}: ids may only be added`,
			);
			failed = true;
		}
	}
	if (failed) process.exitCode = 1;
	else console.log(`Id registries are valid and extend ${ref}`);
};

const [command, ...args] = process.argv.slice(2);
try {
	if (command === "seed") seed(args[0]);
	else if (command === "verify") verify(args[0]);
	else if (command === "check") {
		const at = args.indexOf("--base");
		check(at === -1 ? "HEAD" : (args[at + 1] ?? "HEAD"));
	} else throw new Error(USAGE);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
