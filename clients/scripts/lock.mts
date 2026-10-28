import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(here, "..", "..");
export const SPEC = join(ROOT, "services", "api", "openapi.yaml");
export const CLIENTS = join(ROOT, "clients");
export const LOCK = join(CLIENTS, "generated.lock.json");
export const TYPESCRIPT_GENERATED = join(
	CLIENTS,
	"typescript",
	"src",
	"generated",
);
export const PYTHON_GENERATED = join(
	CLIENTS,
	"python",
	"src",
	"uk_data_atlas_client",
	"generated",
);

/** Everything besides the spec that decides what a generator writes. */
const TOOLING = [
	join(CLIENTS, "python", "requirements-generate.txt"),
	join(CLIENTS, "python", "prepare_spec.py"),
	join(CLIENTS, "python", "config.yaml"),
	join(CLIENTS, "scripts", "generate.mts"),
];

export type Lock = {
	/** SHA-256 of `services/api/openapi.yaml`. */
	spec: string;
	/** SHA-256 of the generator pins and the scripts that run them. */
	tooling: string;
	/** SHA-256 of each generated tree, as committed. */
	typescript: string;
	python: string;
};

const sha256 = (...parts: (string | Buffer)[]) => {
	const hash = createHash("sha256");
	for (const part of parts) hash.update(part).update("\0");
	return hash.digest("hex");
};

const files = (directory: string): string[] =>
	readdirSync(directory)
		.sort()
		.flatMap((name) => {
			const path = join(directory, name);
			if (name === "__pycache__") return [];
			return statSync(path).isDirectory() ? files(path) : [path];
		});

/** A digest of every file's path and bytes, so any edit, add or delete shows. */
export const hashTree = (directory: string) =>
	sha256(
		...files(directory).flatMap((path) => [
			relative(directory, path),
			readFileSync(path),
		]),
	);

export const hashSpec = () => sha256(readFileSync(SPEC));

export const hashTooling = (typescriptGenerator: string) =>
	sha256(
		typescriptGenerator,
		...TOOLING.flatMap((path) => [
			relative(ROOT, path),
			readFileSync(path),
		]),
	);

/** The pinned `openapi-typescript` version, which the TypeScript output tracks. */
export const typescriptGeneratorVersion = (): string =>
	JSON.parse(
		readFileSync(join(CLIENTS, "typescript", "package.json"), "utf8"),
	).devDependencies["openapi-typescript"];

export const computeLock = (): Lock => ({
	spec: hashSpec(),
	tooling: hashTooling(typescriptGeneratorVersion()),
	typescript: hashTree(TYPESCRIPT_GENERATED),
	python: hashTree(PYTHON_GENERATED),
});

export const readLock = (): Lock => JSON.parse(readFileSync(LOCK, "utf8"));
