import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	unlinkSync,
	utimesSync,
	writeFileSync,
	readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { onTestFinished, test, vi } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";

const sha256 = (path: string) =>
	createHash("sha256").update(readFileSync(path)).digest("hex");

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	cacheable?: boolean;
	outputs?: string[];
};

const stage = (
	name: string,
	dependencies: string[] = [],
	cacheable = true,
	outputs: string[] = [],
): Stage => ({ name, dependencies, args: [name], cacheable, outputs });

// download feeds data/; compile and summary write outputs; report reads compile.
const stages = [
	stage("download", [], false),
	stage("compile", ["download"], true, ["data/build/datasets"]),
	stage("summary", ["download"]),
	stage("report", ["compile"]),
];

let writes = 0;

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-cache-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	write("data/source/input.csv", "a,b\n");
	write("code.ts", "export {};\n");
	const outputs: Record<string, string> = {
		compile: "data/build/datasets/compiled.json",
		summary: "data/build/artifacts/summary.json",
		report: "public/data/report.json",
	};
	const ran: string[] = [];
	const hashed: string[] = [];
	// Stages listed here always write the same bytes.
	const fixed: Record<string, string> = {};
	const failing = new Set<string>();
	const build = (argv: string[] = []) => {
		const log: string[] = [];
		const errors: string[] = [];
		const status = runBuild({
			argv,
			stages,
			log: (line: string) => log.push(line),
			logError: (message: string) => errors.push(message),
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => ["code.ts"],
					environment: {},
					hashFile: (path: string) => {
						hashed.push(relative(root, path));
						return sha256(path);
					},
				}),
			execute: (current: Stage) => {
				ran.push(current.name);
				if (failing.has(current.name)) return 1;
				const output = outputs[current.name];
				if (output)
					write(
						output,
						fixed[current.name] ??
							`${current.name} ${(writes += 1)}\n`,
					);
				return 0;
			},
		});
		return { status, log, errors };
	};
	const runs = (argv: string[] = []) => {
		ran.length = 0;
		const result = build(argv);
		assert.equal(result.status, 0);
		return [...ran];
	};
	return { root, write, runs, build, ran, hashed, fixed, failing, outputs };
}

test("a second build reruns only the stages that always run", () => {
	const { runs } = fixture();
	assert.deepEqual(runs(), ["download", "compile", "summary", "report"]);
	assert.deepEqual(runs(), ["download"]);
});

test("--only builds prerequisites on a clean run and reuses their cached outputs", () => {
	const { runs } = fixture();
	assert.deepEqual(runs(["--only", "report"]), [
		"download",
		"compile",
		"report",
	]);
	assert.deepEqual(runs(["--only", "report"]), ["download"]);
	assert.deepEqual(runs(["--only", "report", "--no-cache"]), [
		"download",
		"compile",
		"report",
	]);
});

test("changed data or code reruns every cached stage", () => {
	const { runs, write } = fixture();
	runs();
	write("data/source/input.csv", "a,b,c\n");
	assert.deepEqual(runs(), ["download", "compile", "summary", "report"]);
	write("code.ts", "export const changed = true;\n");
	assert.deepEqual(runs(), ["download", "compile", "summary", "report"]);
	// The download marker records the release, not the data itself.
	write("data/source/.source-release.json", "{}\n");
	assert.deepEqual(runs(), ["download"]);
});

test("a missing or edited output reruns its stage and the stages that read it", () => {
	const { runs, root, write, outputs } = fixture();
	runs();
	unlinkSync(join(root, outputs.compile));
	assert.deepEqual(runs(), ["download", "compile", "report"]);
	write(outputs.report, "edited\n");
	assert.deepEqual(runs(), ["download", "report"]);
	assert.deepEqual(runs(), ["download"]);
});

test("a failed stage is rebuilt next time even if its outputs look unchanged", () => {
	const { runs, build, failing, ran } = fixture();
	runs();
	failing.add("compile");
	ran.length = 0;
	const result = build(["--from", "compile"]);
	assert.equal(result.status, 1);
	failing.clear();
	assert.deepEqual(runs(), ["download", "compile", "report"]);
});

test("--no-cache and --from run every selected stage", () => {
	const { runs } = fixture();
	runs();
	assert.deepEqual(runs(["--no-cache"]), [
		"download",
		"compile",
		"summary",
		"report",
	]);
	assert.deepEqual(runs(["--from", "compile"]), ["compile", "report"]);
	// Both refresh the cache for the next build.
	assert.deepEqual(runs(), ["download"]);
});

test("a plan marks the stages it would skip", () => {
	const { runs, root, outputs, build, ran } = fixture();
	runs();
	unlinkSync(join(root, outputs.compile));
	ran.length = 0;
	const { log } = build(["--plan"]);
	assert.deepEqual(ran, []);
	assert.equal(
		log.some((line) => line.startsWith("Data build done")),
		false,
	);
	assert.equal(log[0], "Data build plan: 4 stages, 3 to run, 1 unchanged");
	assert.deepEqual(
		log
			.filter((line) => /^[a-z]/.test(line) && !line.startsWith("Data"))
			.map((line) => line.split(": ")),
		[
			["download", "would run"],
			["compile", "would run"],
			["summary", "unchanged, would skip"],
			["report", "would run"],
		],
	);
	assert.ok(log.includes("  Depends on: compile"));
	assert.equal(existsSync(join(root, outputs.compile)), false);
});

test("a stage owns the files in its declared folders, even ones it kept", () => {
	const { runs, root, write } = fixture();
	write("data/build/datasets/kept.json", "from an earlier build\n");
	runs();
	// compile does not rewrite kept.json, but it is still compile's.
	unlinkSync(join(root, "data/build/datasets/kept.json"));
	assert.deepEqual(runs(), ["download", "compile", "report"]);
});

test("a later writer can update a shared database while its builder still rebuilds a missing file", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-shared-build-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas.sqlite");
	const sharedStages = [
		{
			name: "base",
			dependencies: [],
			args: [],
			requiredOutputs: ["data/build/atlas.sqlite"],
		},
		{ name: "final", dependencies: ["base"], args: [] },
	];
	const run = () => {
		const executed: string[] = [];
		assert.equal(
			runBuild({
				stages: sharedStages,
				log: () => {},
				createCache: () =>
					createStageCache({
						root,
						stateFile: join(root, ".cache/stages.json"),
						codeFiles: () => [],
						environment: {},
					}),
				execute: (current: { name: string }) => {
					executed.push(current.name);
					writeFileSync(path, current.name);
					return 0;
				},
			}),
			0,
		);
		return executed;
	};
	assert.deepEqual(run(), ["base", "final"]);
	assert.deepEqual(run(), []);
	unlinkSync(path);
	assert.deepEqual(run(), ["base", "final"]);
	assert.deepEqual(run(), []);
});

test("a build prints a line for each stage and ranks the slowest", () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	const status = runBuild({
		stages: Array.from({ length: 6 }, (_, index) =>
			stage(`stage-${index + 1}`),
		),
		execute: (stage: Stage) => {
			now += Number(stage.name.slice(-1)) * 1000;
			return 0;
		},
		log: (line: string) => {
			log.push(line);
			if (line.includes(": running")) now += 500;
		},
	});
	assert.equal(status, 0);
	assert.deepEqual(log, [
		"Data build: 6 stages, 6 to run, 0 unchanged",
		"",
		"stage-1: running (1 of 6)",
		"stage-1: done in 1.5s",
		"stage-2: running (2 of 6)",
		"stage-2: done in 2.5s",
		"stage-3: running (3 of 6)",
		"stage-3: done in 3.5s",
		"stage-4: running (4 of 6)",
		"stage-4: done in 4.5s",
		"stage-5: running (5 of 6)",
		"stage-5: done in 5.5s",
		"stage-6: running (6 of 6)",
		"stage-6: done in 6.5s",
		"",
		"Data build done in 24s (6 ran, 0 unchanged)",
		"Slowest stages:",
		"  stage-6  6.5s",
		"  stage-5  5.5s",
		"  stage-4  4.5s",
		"  stage-3  3.5s",
		"  stage-2  2.5s",
	]);
});

test("a verbose build adds each command and the command and overhead split", () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	let verbose: boolean | undefined;
	runBuild({
		argv: ["--verbose"],
		stages: [stage("first")],
		execute: (_stage: Stage, options: { verbose: boolean }) => {
			verbose = options.verbose;
			now += 2000;
			return 0;
		},
		log: (line: string) => {
			log.push(line);
			if (line.includes(": running")) now += 500;
		},
	});
	assert.equal(verbose, true);
	assert.deepEqual(log.slice(2, 5), [
		"first: running (1 of 1)",
		"  Command: pnpm first",
		"  Depends on: none",
	]);
	assert.equal(log.at(-1), "  first  2.5s (command 2.0s, overhead 0.5s)");
});

test("a failed stage reports its exit status on stderr and still prints the summary", () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	const errors: string[] = [];
	const status = runBuild({
		stages: [stage("failing"), stage("unreached")],
		execute: () => {
			now += 1250;
			return 2;
		},
		log: (line: string) => log.push(line),
		logError: (message: string) => errors.push(message),
	});
	assert.equal(status, 2);
	assert.deepEqual(errors, [
		"failing failed with exit code 2 after 1.3s. Build stopped",
	]);
	assert.deepEqual(log.slice(2), [
		"failing: running (1 of 2)",
		"",
		"Data build failed after 1.3s (0 ran, 1 failed, 0 unchanged)",
		"Slowest stages:",
		"  failing  1.3s",
	]);
});

test("a rebuild says which stages are unchanged and leaves them out of the ranking", () => {
	const { runs, build } = fixture();
	runs();
	const { status, log } = build();
	assert.equal(status, 0);
	assert.equal(log[0], "Data build: 4 stages, 1 to run, 3 unchanged");
	for (const name of ["compile", "summary", "report"])
		assert.ok(log.includes(`${name}: unchanged, skipped`), name);
	assert.ok(log.includes("download: running (1 of 1)"));
	const ranking = log.slice(log.indexOf("Slowest stages:") + 1);
	assert.equal(ranking.length, 1);
	assert.match(ranking[0], /^ {2}download {2}\S+$/);
	assert.match(log.at(-ranking.length - 2)!, /\(1 ran, 3 unchanged\)$/);
});

test("restoring a deleted shared API cache rebuilds every component", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-component-build-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas-cache.sqlite");
	const components = ["place-index", "area-search-index", "postcode-counts"];
	const selected = components.map((name) => {
		const original = buildDataStages.find(
			(entry: Stage) => entry.name === name,
		);
		assert.ok(original);
		return { ...original, dependencies: ["base"] };
	});
	const run = () => {
		const executed: string[] = [];
		assert.equal(
			runBuild({
				stages: [
					{
						name: "base",
						dependencies: [],
						args: [],
						requiredOutputs: ["data/build/atlas-cache.sqlite"],
					},
					...selected,
				],
				log: () => {},
				createCache: () =>
					createStageCache({
						root,
						stateFile: join(root, ".cache/stages.json"),
						codeFiles: () => [],
						environment: {},
					}),
				execute: (current: { name: string }) => {
					executed.push(current.name);
					const values =
						current.name === "base"
							? []
							: JSON.parse(readFileSync(path, "utf8"));
					writeFileSync(
						path,
						JSON.stringify([...new Set([...values, current.name])]),
					);
					return 0;
				},
			}),
			0,
		);
		assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), [
			"base",
			...components,
		]);
		return executed;
	};
	assert.deepEqual(run(), ["base", ...components]);
	assert.deepEqual(run(), components);
	unlinkSync(path);
	assert.deepEqual(run(), ["base", ...components]);
});

test("adopt reuses current outputs after a cache version change without executing stages", () => {
	const { runs, root, write, build, ran } = fixture();
	runs();
	const statePath = join(root, ".cache/stages.json");
	const old = JSON.parse(readFileSync(statePath, "utf8"));
	old.version = -1;
	write(".cache/stages.json", JSON.stringify(old));
	write("code.ts", "export const current = true;");
	write("data/build/datasets/compiled.json", "trusted existing bytes");
	ran.length = 0;
	const { log } = build(["--adopt"]);
	assert.deepEqual(ran, []);
	assert.ok(log.includes("compile: adopted 1 output file"));
	assert.ok(!log.includes("  data/build/datasets/compiled.json"));
	assert.ok(
		build(["--adopt", "--verbose"]).log.includes(
			"  data/build/datasets/compiled.json",
		),
	);
	assert.deepEqual(runs(), ["download"]);
	unlinkSync(join(root, "data/build/datasets/compiled.json"));
	assert.deepEqual(runs(), ["download", "compile", "report"]);
});

test("adopt only selects prerequisites and plan does not change the cache", () => {
	const { runs, root, write, build, ran } = fixture();
	runs();
	write("code.ts", "export const current = true;");
	const statePath = join(root, ".cache/stages.json");
	const before = readFileSync(statePath, "utf8");
	ran.length = 0;
	const planned = build(["--adopt", "--only", "report", "--plan"]);
	assert.deepEqual(ran, []);
	assert.ok(planned.log.includes("report: would adopt existing outputs"));
	assert.equal(readFileSync(statePath, "utf8"), before);
	assert.deepEqual(runs(["--adopt", "--only", "report"]), []);
	assert.deepEqual(runs(), ["download", "summary"]);
});

test("adoption preflights missing inventory files before saving any selected stage", () => {
	const { runs, root, build, outputs } = fixture();
	runs();
	const statePath = join(root, ".cache/stages.json");
	const before = readFileSync(statePath, "utf8");
	unlinkSync(join(root, outputs.report));
	assert.throws(
		() => build(["--adopt"]),
		/Cannot adopt report: missing output/,
	);
	assert.equal(readFileSync(statePath, "utf8"), before);
});

test("adoption validates required outputs and declared folders without an old cache", () => {
	const { root, write } = fixture();
	const cache = createStageCache({
		root,
		codeFiles: () => ["code.ts"],
		environment: {},
	});
	const current = {
		name: "new",
		args: [],
		requiredOutputs: ["data/build/required.json"],
		outputs: ["data/build/folder"],
	};
	assert.throws(
		() => cache.adopt(current, []),
		/missing output data\/build\/folder/,
	);
	write("data/build/folder/item.json", "{}");
	const freshCache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	assert.throws(
		() => freshCache().adopt(current, []),
		/missing output data\/build\/required.json/,
	);
	write("data/build/required.json", "{}");
	const complete = freshCache();
	const adopted = complete.adopt(current, []);
	assert.deepEqual(adopted.files, [
		"data/build/folder/item.json",
		"data/build/required.json",
	]);
	assert.equal(complete.lookup(current, []), adopted.digest);
	assert.throws(
		() => complete.adopt({ name: "unknown", args: [] }, []),
		/no output inventory/,
	);
});

test("adoption rejects conflicting execution flags", () => {
	const { build } = fixture();
	assert.throws(() => build(["--adopt", "--no-cache"]), /cannot be combined/);
	assert.throws(
		() => build(["--adopt", "--from", "compile"]),
		/cannot be combined/,
	);
});

test("partial adoption preserves obsolete inventories for a later adoption", () => {
	const { runs, root, write } = fixture();
	runs();
	const old = JSON.parse(
		readFileSync(join(root, ".cache/stages.json"), "utf8"),
	);
	old.version = -1;
	write(".cache/stages.json", JSON.stringify(old));
	assert.deepEqual(runs(["--adopt", "--only", "compile"]), []);
	assert.deepEqual(runs(["--adopt", "--only", "summary"]), []);
	assert.deepEqual(runs(), ["download", "report"]);
});

// A rewrite with a new mtime but the same bytes, as a rebuild would leave.
const touch = (root: string, path: string) => {
	const later = new Date(Date.now() + 60_000);
	utimesSync(join(root, path), later, later);
};

test("a stage that rewrites identical bytes does not rerun its dependants", () => {
	const { runs, root, outputs, fixed } = fixture();
	fixed.compile = "stable\n";
	runs();
	touch(root, outputs.compile);
	assert.deepEqual(runs(), ["download", "compile"]);
	assert.deepEqual(runs(), ["download"]);
	unlinkSync(join(root, outputs.compile));
	assert.deepEqual(runs(), ["download", "compile"]);
	assert.deepEqual(runs(), ["download"]);
});

test("a stage that writes different bytes reruns its dependants", () => {
	const { runs, root, outputs, fixed } = fixture();
	fixed.compile = "stable\n";
	runs();
	fixed.compile = "changed\n";
	touch(root, outputs.compile);
	assert.deepEqual(runs(), ["download", "compile", "report"]);
	assert.deepEqual(runs(), ["download"]);
});

test("files with unchanged size and mtime are not hashed again", () => {
	const { runs, root, write, hashed, outputs } = fixture();
	write("data/build/datasets/kept.json", "kept\n");
	runs();
	assert.deepEqual(
		[...hashed].sort(),
		[
			"data/build/datasets/compiled.json",
			"data/build/datasets/kept.json",
			"public/data/report.json",
			"data/build/artifacts/summary.json",
		].sort(),
	);
	hashed.length = 0;
	assert.deepEqual(runs(), ["download"]);
	assert.equal(hashed.length, 0);
	// compile reruns, but kept.json still matches its record.
	touch(root, outputs.compile);
	runs();
	assert.ok(hashed.includes(outputs.compile));
	assert.ok(!hashed.includes("data/build/datasets/kept.json"));
});

test("an upstream stage rewriting identical bytes still restores a file a downstream stage changed", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-shared-rewrite-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas.sqlite");
	const chain = [
		{
			name: "base",
			dependencies: [],
			args: [],
			requiredOutputs: ["data/build/atlas.sqlite"],
		},
		{ name: "middle", dependencies: ["base"], args: [] },
		{ name: "final", dependencies: ["middle"], args: [] },
	];
	const executed: string[] = [];
	const run = () => {
		executed.length = 0;
		runBuild({
			stages: chain,
			log: () => {},
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => [],
					environment: {},
				}),
			execute: (current: { name: string }) => {
				executed.push(current.name);
				// base and final write the database; middle only reads it.
				if (current.name !== "middle")
					writeFileSync(path, current.name);
				return 0;
			},
		});
		return [...executed];
	};
	assert.deepEqual(run(), ["base", "middle", "final"]);
	assert.deepEqual(run(), []);
	// Recreating base's bytes wipes final's changes, so final must run again.
	unlinkSync(path);
	assert.deepEqual(run(), ["base", "final"]);
	assert.equal(readFileSync(path, "utf8"), "final");
	assert.deepEqual(run(), []);
});

test("adopt records content digests and a normal build then skips", () => {
	const { runs, root, write, build, ran, hashed, outputs } = fixture();
	runs();
	const statePath = join(root, ".cache/stages.json");
	const current = JSON.parse(readFileSync(statePath, "utf8"));
	// An old record: version 2 with size:mtimeMs strings and no hashes.
	const legacy = JSON.parse(JSON.stringify(current));
	legacy.version = 2;
	for (const record of Object.values<{ outputs: Record<string, unknown> }>(
		legacy.stages,
	))
		for (const [path, entry] of Object.entries(record.outputs)) {
			const { size, mtimeMs } = entry as {
				size: number;
				mtimeMs: number;
			};
			record.outputs[path] = `${size}:${mtimeMs}`;
		}
	write(".cache/stages.json", JSON.stringify(legacy));
	ran.length = 0;
	hashed.length = 0;
	build(["--adopt"]);
	assert.deepEqual(ran, []);
	assert.equal(hashed.length, 3);
	const adopted = JSON.parse(readFileSync(statePath, "utf8"));
	assert.equal(adopted.version, current.version);
	for (const name of ["compile", "summary", "report"]) {
		assert.equal(adopted.stages[name].digest, current.stages[name].digest);
		for (const entry of Object.values<{ sha256: string }>(
			adopted.stages[name].outputs,
		))
			assert.match(entry.sha256, /^[0-9a-f]{64}$/);
	}
	assert.equal(
		adopted.stages.compile.outputs[outputs.compile].sha256,
		sha256(join(root, outputs.compile)),
	);
	hashed.length = 0;
	assert.deepEqual(runs(), ["download"]);
	assert.equal(hashed.length, 0);
});
