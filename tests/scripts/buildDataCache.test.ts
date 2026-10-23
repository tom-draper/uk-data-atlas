import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache } from "@/scripts/build-data-cache.mjs";
import { runBuild } from "@/scripts/build-data.mjs";

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
		summary: "services/api/public/summary.json",
		report: "public/data/report.json",
	};
	const ran: string[] = [];
	const failing = new Set<string>();
	const build = (argv: string[] = []) => {
		const log: string[] = [];
		const status = runBuild({
			argv,
			stages,
			log: (line: string) => log.push(line),
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => ["code.ts"],
					environment: {},
				}),
			execute: (current: Stage) => {
				ran.push(current.name);
				if (failing.has(current.name)) return 1;
				const output = outputs[current.name];
				if (output) write(output, `${current.name} ${(writes += 1)}\n`);
				return 0;
			},
		});
		return { status, log };
	};
	const runs = (argv: string[] = []) => {
		ran.length = 0;
		const result = build(argv);
		assert.equal(result.status, 0);
		return [...ran];
	};
	return { root, write, runs, build, ran, failing, outputs };
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
	assert.deepEqual(
		log.map((line) => [
			line.split(":")[0],
			line.endsWith("(unchanged, skipped)"),
		]),
		[
			["download", false],
			["compile", false],
			["summary", true],
			["report", false],
		],
	);
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
