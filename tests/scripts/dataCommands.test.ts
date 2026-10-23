import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { expect, onTestFinished, test } from "vitest";

function runDevCheck(fresh: boolean, compileStatus = 0) {
	const directory = mkdtempSync(join(tmpdir(), "atlas-dev-data-"));
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	const trace = join(directory, "trace.jsonl");
	const executable = join(directory, "pnpm");
	writeFileSync(
		executable,
		`#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.COMMAND_TRACE, JSON.stringify(args) + "\\n");
process.exit(args[0] === "data:verify" ? ${fresh ? 0 : 1} : ${compileStatus});
`,
	);
	chmodSync(executable, 0o755);
	const result = spawnSync(
		process.execPath,
		[resolve("scripts/ensure-website-data.mjs")],
		{
			cwd: directory,
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${directory}${delimiter}${process.env.PATH}`,
				COMMAND_TRACE: trace,
				ATLAS_FORCE_PRECOMPILE: "0",
			},
		},
	);
	const commands = readFileSync(trace, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	return { result, commands };
}

test("dev startup skips compilation when website data verifies", () => {
	const { result, commands } = runDevCheck(true);
	expect(result.status).toBe(0);
	expect(commands).toEqual([["data:verify", "--target", "website"]]);
});

test("dev startup builds missing data through the pipeline before any copy command", () => {
	const { result, commands } = runDevCheck(false);
	expect(result.status).toBe(0);
	expect(commands).toEqual([
		["data:verify", "--target", "website"],
		["data:compile", "--target", "website"],
	]);
});

test("dev startup propagates compilation failure", () => {
	const { result } = runDevCheck(false, 23);
	expect(result.status).toBe(23);
});

test.each([
	[],
	["--target", "api"],
	["--target", "all"],
	["--target", "website", "--extra"],
])(
	"verification rejects unsupported scope %j before accessing data",
	(...args: string[]) => {
		const result = spawnSync(
			process.execPath,
			["--import", "tsx", "scripts/verify-data.mts", ...args],
			{
				encoding: "utf8",
			},
		);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain(
			"Only website verification is currently supported",
		);
	},
);
