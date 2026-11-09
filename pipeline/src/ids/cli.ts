import { buildLog } from "@uk-data-atlas/atlas-db";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { findIdMismatches } from "./databaseKeys.ts";
import {
	ID_DIRECTORY,
	IdRegistries,
	idDirectory,
	idNamespaces,
	idRegistryPath,
	ID_NAMESPACES,
} from "./idRegistries.ts";
import { registryProblems } from "./checkRegistries.ts";
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
			buildLog.info(`${namespace}: ${size} ids`);
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
			buildLog.info(`${namespace}: ${count} ids checked`);
		for (const m of mismatches)
			console.error(
				`${m.namespace} ${m.id} is ${m.key.join("/")}, which the registry gives ${m.registered ?? "no id"}`,
			);
		if (mismatches.length > 0) process.exitCode = 1;
	} finally {
		database.close();
	}
};

const git = (...args: string[]) =>
	execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 1 << 30,
	});

/** Every registry file in the working tree, by path inside `pipeline/ids`. */
const workingFiles = (directory: string, prefix = ""): [string, string][] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? workingFiles(
					join(directory, entry.name),
					`${prefix}${entry.name}/`,
				)
			: entry.name.endsWith(".txt")
				? [
						[
							`${prefix}${entry.name}`,
							readFileSync(join(directory, entry.name), "utf8"),
						],
					]
				: [],
	);

/** Every registry file as it was at `ref`. */
const committedFiles = (ref: string): [string, string][] => {
	try {
		git("rev-parse", "--verify", `${ref}^{commit}`);
	} catch {
		throw new Error(
			`Cannot find ${ref}. Fetch it first, for example git fetch origin main --depth=1.`,
		);
	}
	const listed = git("ls-tree", "-r", "--name-only", ref, "--", ID_DIRECTORY)
		.split("\n")
		.filter((path) => path.endsWith(".txt"));
	return listed.map((path) => [
		path.slice(ID_DIRECTORY.length + 1),
		git("show", `${ref}:${path}`),
	]);
};

const check = (ref: string) => {
	const directory = idDirectory(root);
	// Loading refuses blank lines, repeated keys, the wrong number of fields,
	// and ids that are missing or given twice.
	IdRegistries.load(directory);
	const current = new Map(workingFiles(directory));
	const problems = registryProblems(current, new Map(committedFiles(ref)));
	for (const name of idNamespaces) {
		const path = relative(directory, idRegistryPath(directory, name));
		const present = ID_NAMESPACES[name].segmented
			? [...current.keys()].some((file) => file.startsWith(`${path}/`))
			: current.has(path);
		if (!present) problems.push(`${path} is missing`);
	}
	for (const problem of problems) console.error(problem);
	if (problems.length > 0) process.exitCode = 1;
	else buildLog.info(`Id registries are valid and extend ${ref}`);
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
