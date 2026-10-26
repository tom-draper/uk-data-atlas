import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	CLIENTS,
	SPEC,
	TYPESCRIPT_GENERATED,
	computeLock,
	readLock,
} from "../../clients/scripts/lock.mjs";

/**
 * The generated clients are committed. They go stale when openapi.yaml, a
 * generator pin or the generation scripts change without a regeneration, or
 * when someone edits generated code by hand. Neither check needs a running API
 * or any data, nor the Python toolchain: generated.lock.json records a digest
 * of the spec, the tooling and each generated tree, and the TypeScript
 * generator is cheap enough to run again here. `generate:clients --check`
 * regenerates both languages and is the full check, run locally.
 */
const REGENERATE = "Run: pnpm --dir services/api generate:clients";

describe("generated API clients", () => {
	it("were generated from the current openapi.yaml and tooling", () => {
		const lock = readLock();
		const current = computeLock();
		expect(
			current.spec,
			`${SPEC} changed since the clients were generated. ${REGENERATE}`,
		).toBe(lock.spec);
		expect(
			current.tooling,
			`A generator pin or generation script changed. ${REGENERATE}`,
		).toBe(lock.tooling);
		expect(
			current.typescript,
			`The TypeScript client differs from generated.lock.json. ${REGENERATE}`,
		).toBe(lock.typescript);
		expect(
			current.python,
			`The Python client differs from generated.lock.json. ${REGENERATE}`,
		).toBe(lock.python);
	});

	it("include the TypeScript types openapi-typescript writes for the spec", () => {
		const scratch = mkdtempSync(join(tmpdir(), "atlas-schema-"));
		try {
			const out = join(scratch, "schema.ts");
			const run = spawnSync(
				"pnpm",
				[
					"--dir",
					join(CLIENTS, "typescript"),
					"exec",
					"openapi-typescript",
					SPEC,
					"-o",
					out,
				],
				{ encoding: "utf8" },
			);
			expect(run.status, run.stderr).toBe(0);
			expect(
				readFileSync(out, "utf8") ===
					readFileSync(
						join(TYPESCRIPT_GENERATED, "schema.ts"),
						"utf8",
					),
				`schema.ts is stale. ${REGENERATE}`,
			).toBe(true);
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	});
});
