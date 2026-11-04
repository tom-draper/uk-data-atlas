import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache, stageScope } from "@/pipeline/build-data-cache.mjs";

type Stage = {
	name: string;
	args: string[];
	writes?: string[];
	outputs?: string[];
	requiredOutputs?: string[];
};

const alpha: Stage = { name: "alpha", args: [], writes: ["data/build/a"] };
const beta: Stage = {
	name: "beta",
	args: [],
	writes: ["data/build/b.json"],
	outputs: ["data/build/b"],
};

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-scope-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	const cache = () =>
		createStageCache({
			root,
			stateFile: join(root, ".cache/stages.json"),
			codeFiles: () => [],
			environment: {},
		});
	return { root, write, cache };
}

const outputsOf = (root: string, name: string) =>
	Object.keys(
		JSON.parse(readFileSync(join(root, ".cache/stages.json"), "utf8"))
			.stages[name].outputs,
	);

test("a stage's scope joins its writes, outputs and required outputs", () => {
	assert.deepEqual(
		stageScope({
			writes: ["x", "y"],
			outputs: ["y", "z"],
			requiredOutputs: ["x", "w"],
		}),
		["x", "y", "z", "w"],
	);
	assert.equal(stageScope({}), null);
});

test("stages with separate scopes can run at once and record only their own files", () => {
	const { root, write, cache } = fixture();
	const concurrent = cache();
	concurrent.begin(alpha);
	concurrent.begin(beta);
	write("data/build/b.json", "{}");
	write("data/build/b/one.json", "1");
	write("data/build/a/one.json", "a");
	const betaDigest = concurrent.record(beta, []);
	const alphaDigest = concurrent.record(alpha, []);
	assert.deepEqual(outputsOf(root, "alpha"), ["data/build/a/one.json"]);
	assert.deepEqual(outputsOf(root, "beta"), [
		"data/build/b.json",
		"data/build/b/one.json",
	]);

	// The same stages run one after another give the same digests.
	const sequential = fixture();
	const cold = sequential.cache();
	cold.begin(alpha);
	sequential.write("data/build/a/one.json", "a");
	assert.equal(cold.record(alpha, []), alphaDigest);
	cold.begin(beta);
	sequential.write("data/build/b.json", "{}");
	sequential.write("data/build/b/one.json", "1");
	assert.equal(cold.record(beta, []), betaDigest);
});

test("a recorded stage is skipped again from its own files alone", () => {
	const { write, cache } = fixture();
	const first = cache();
	first.begin(alpha);
	write("data/build/a/one.json", "a");
	const digest = first.record(alpha, []);
	assert.equal(cache().lookup(alpha, []), digest);
	// Another stage's file in the same tree does not disturb it.
	write("data/build/unrelated.json", "u");
	assert.equal(cache().lookup(alpha, []), digest);
	write("data/build/a/one.json", "edited, longer");
	assert.equal(cache().lookup(alpha, []), null);
});

test("a scoped stage keeps its earlier files outside the scope", () => {
	const { root, write, cache } = fixture();
	const wide: Stage = {
		name: "wide",
		args: [],
		writes: ["data/build/w1.json", "data/build/w2.json"],
	};
	const narrow = { ...wide, writes: ["data/build/w1.json"] };
	const first = cache();
	first.begin(wide);
	write("data/build/w1.json", "1");
	write("data/build/w2.json", "2");
	first.record(wide, []);
	const second = cache();
	second.begin(narrow);
	write("data/build/w1.json", "11");
	second.record(narrow, []);
	assert.deepEqual(outputsOf(root, "wide"), [
		"data/build/w1.json",
		"data/build/w2.json",
	]);
});

test("a stage without a scope tracks the whole tree after scoped stages ran", () => {
	const { root, write, cache } = fixture();
	const running = cache();
	running.begin(alpha);
	write("data/build/a/one.json", "a");
	running.record(alpha, []);
	const exclusive: Stage = { name: "exclusive", args: [] };
	running.begin(exclusive);
	write("data/build/other.json", "o");
	running.record(exclusive, []);
	assert.deepEqual(outputsOf(root, "exclusive"), ["data/build/other.json"]);
	assert.deepEqual(outputsOf(root, "alpha"), ["data/build/a/one.json"]);
});

test("a directory listed as a required output never counts as present", () => {
	const { write, cache } = fixture();
	const catalog: Stage = {
		name: "catalog",
		args: [],
		writes: ["data/build/observations"],
		requiredOutputs: ["data/build/observations"],
	};
	const first = cache();
	first.begin(catalog);
	write("data/build/observations/one.json", "1");
	first.record(catalog, []);
	assert.equal(cache().lookup(catalog, []), null);
});

test("an audited stage reports files it changed outside its scope", () => {
	const { write, cache } = fixture();
	const current = cache();
	current.begin(alpha, { audit: true });
	write("data/build/a/one.json", "inside");
	write("data/build/stray.json", "outside");
	write("public/data/other/two.json", "outside too");
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/build/stray.json",
		"public/data/other/two.json",
	]);
	// Without an audit, or without a scope, there is nothing to report.
	current.begin(beta);
	write("data/build/stray.json", "changed again");
	assert.deepEqual(current.undeclaredChanges(beta), []);
	const unscoped: Stage = { name: "unscoped", args: [] };
	current.begin(unscoped, { audit: true });
	assert.deepEqual(current.undeclaredChanges(unscoped), []);
});

test("an audited stage that changes a raw source file is reported", () => {
	const { write, cache } = fixture();
	write("data/source/input.csv", "a\n");
	const current = cache();
	current.begin(alpha, { audit: true });
	write("data/build/a/one.json", "inside");
	write("data/source/input.csv", "changed by a build stage");
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/source/input.csv",
	]);
});

test("a stage with a declared scope does not discard other stages' cached keys", () => {
	const { root, write } = fixture();
	let codeReads = 0;
	const current = createStageCache({
		root,
		stateFile: join(root, ".cache/stages.json"),
		codeFiles: () => {
			codeReads += 1;
			return [];
		},
		environment: {},
	});
	const quiet: Stage = { name: "quiet", args: [], writes: ["data/build/q"] };
	const registry: Stage = { name: "registry", args: [] };
	current.begin(alpha);
	write("data/build/a/one.json", "a");
	current.record(alpha, []);
	current.lookup(alpha, []);
	const reads = codeReads;
	// A non-cacheable stage with a scope leaves the code keys alone.
	current.begin(quiet);
	current.record(quiet, [], { cacheable: false });
	current.lookup(alpha, []);
	assert.equal(codeReads, reads);
	// One without a scope may have rewritten code or sources, so they reset.
	current.begin(registry);
	current.record(registry, [], { cacheable: false });
	current.lookup(alpha, []);
	assert.equal(codeReads, reads + 1);
});
