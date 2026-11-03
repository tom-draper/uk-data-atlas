/**
 * Writes the TypeScript and Python clients from services/api/openapi.yaml.
 * The generated code is not committed: it is written into
 * typescript/src/generated/ and python/src/uk_data_atlas_client/generated/,
 * both ignored by Git.
 *
 *   pnpm clients:generate               both clients
 *   pnpm clients:generate:typescript    the TypeScript types only
 *
 * Neither needs a running API or any data. The TypeScript types need only
 * node_modules, and typecheck runs them. Python tooling lives in
 * clients/python/.venv, which this creates and fills from the pinned
 * requirements-generate.txt on first use.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CLIENTS,
	PYTHON_GENERATED,
	SPEC,
	TYPESCRIPT_GENERATED,
} from "./paths.mjs";

const run = (command: string, args: string[], cwd: string) => {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.status !== 0) {
		process.stderr.write(result.stdout + result.stderr);
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
	return result.stdout + result.stderr;
};

/** `schema.ts`: the paths, operations and component types of the spec. */
const generateTypescript = (out: string) => {
	mkdirSync(out, { recursive: true });
	run(
		"pnpm",
		[
			"--dir",
			join(CLIENTS, "typescript"),
			"exec",
			"openapi-typescript",
			SPEC,
			"-o",
			join(out, "schema.ts"),
		],
		CLIENTS,
	);
};

const venvBin = (name: string) => join(CLIENTS, "python", ".venv", "bin", name);

const prepareVenv = () => {
	const python = join(CLIENTS, "python");
	if (!existsSync(venvBin("python")))
		run("python3", ["-m", "venv", ".venv"], python);
	run(
		venvBin("python"),
		[
			"-m",
			"pip",
			"install",
			"--quiet",
			"--disable-pip-version-check",
			"-r",
			"requirements-generate.txt",
		],
		python,
	);
};

/**
 * The generator drops a schema it cannot read, and the responses that use it,
 * with only a warning. That would quietly shrink the client, so it fails here.
 * Responses in formats it has no model for (YAML, PMTiles, MVT, CSV bodies)
 * are expected to be left out.
 */
const assertNothingDropped = (log: string) => {
	const dropped = log.match(/Unable to process schema .*/g);
	if (dropped)
		throw new Error(
			`openapi-python-client dropped schemas:\n${dropped.join("\n")}\n` +
				"Extend clients/python/prepare_spec.py to cover them.",
		);
};

const generatePython = (out: string) => {
	prepareVenv();
	const work = mkdtempSync(join(tmpdir(), "atlas-python-client-"));
	try {
		const spec = join(work, "openapi.yaml");
		run(
			venvBin("python"),
			[join(CLIENTS, "python", "prepare_spec.py"), SPEC, spec],
			work,
		);
		// Generated outside the repository so ruff cannot pick up repository
		// configuration and format the output differently here than elsewhere.
		const generated = join(work, "generated");
		const log = run(
			venvBin("openapi-python-client"),
			[
				"generate",
				"--path",
				spec,
				"--meta",
				"none",
				"--config",
				join(CLIENTS, "python", "config.yaml"),
				"--output-path",
				generated,
			],
			work,
		);
		assertNothingDropped(log);
		rmSync(join(generated, ".ruff_cache"), {
			recursive: true,
			force: true,
		});
		rmSync(out, { recursive: true, force: true });
		cpSync(generated, out, { recursive: true });
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
};

rmSync(TYPESCRIPT_GENERATED, { recursive: true, force: true });
generateTypescript(TYPESCRIPT_GENERATED);
if (process.argv.includes("--typescript")) {
	console.log("Wrote clients/typescript generated types.");
} else {
	generatePython(PYTHON_GENERATED);
	console.log("Wrote clients/typescript and clients/python generated code.");
}
