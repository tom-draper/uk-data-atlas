import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { buildDataStages } from "@/scripts/build-data-graph.mjs";

test("data stages invoke existing scripts without public command aliases", () => {
	for (const stage of buildDataStages) {
		if (stage.name === "sources") continue;
		const script = stage.args.find((argument: string) =>
			/\.(ts|mts)$/.test(argument),
		);
		expect(script, stage.name).toBeDefined();
		const directory = stage.args.includes("--dir") ? "." : "services/api";
		expect(existsSync(resolve(directory, script ?? "")), stage.name).toBe(
			true,
		);
	}
});

test("data commands use one public vocabulary", () => {
	const root = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
	const api = JSON.parse(
		readFileSync(resolve("services/api/package.json"), "utf8"),
	);
	expect(
		Object.keys(root.scripts)
			.filter((name) => name.startsWith("data:"))
			.sort(),
	).toEqual(["data:build", "data:download", "data:publish", "data:verify"]);
	for (const scripts of [root.scripts, api.scripts])
		expect(
			Object.keys(scripts).filter((name) =>
				/^(build:|datasets:|boundaries:|atlas-data:|seo:)/.test(name),
			),
		).toEqual([]);
});

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
				ATLAS_FORCE_DATA_BUILD: "0",
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
	expect(commands).toEqual([
		["data:verify"],
		["exec", "tsx", "scripts/build-seo-data.mts"],
	]);
});

test("dev startup builds missing data through the pipeline before any copy command", () => {
	const { result, commands } = runDevCheck(false);
	expect(result.status).toBe(0);
	expect(commands).toEqual([["data:verify"], ["data:build"]]);
});

test("dev startup propagates compilation failure without building SEO data", () => {
	const { result, commands } = runDevCheck(false, 23);
	expect(result.status).toBe(23);
	expect(commands).toEqual([["data:verify"], ["data:build"]]);
});

test("dev startup propagates SEO data failure", () => {
	const { result } = runDevCheck(true, 23);
	expect(result.status).toBe(23);
});

test.each([
	["--target", "website"],
	["--target", "api"],
	["--target", "all"],
	["--target", "website", "--extra"],
])(
	"verification rejects arguments %j before accessing data",
	(...args: string[]) => {
		const result = spawnSync(
			process.execPath,
			["--import", "tsx", "scripts/verify-data.mts", ...args],
			{
				encoding: "utf8",
			},
		);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("This command accepts no arguments.");
	},
);
